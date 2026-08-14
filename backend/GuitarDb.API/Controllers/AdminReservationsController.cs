using GuitarDb.API.Attributes;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using MongoDB.Driver;

namespace GuitarDb.API.Controllers;

/// <summary>
/// Admin management of reservations: create, edit, extend, record manual deposits,
/// cancel, and convert to sale. This is the one place the shop owner looks to see
/// what is spoken for.
/// </summary>
[ApiController]
[Route("api/admin/reservations")]
[AdminAuthorize]
public class AdminReservationsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly ReservationService _reservationService;
    private readonly EmailService _emailService;
    private readonly ILogger<AdminReservationsController> _logger;

    public AdminReservationsController(
        MongoDbService mongoDbService,
        ReservationService reservationService,
        EmailService emailService,
        ILogger<AdminReservationsController> logger)
    {
        _mongoDbService = mongoDbService;
        _reservationService = reservationService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// List reservations. Defaults to active only, sorted by expiry ascending so the
    /// ones about to lapse are on top.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetReservations(
        [FromQuery] string? status = null,
        [FromQuery] string? type = null,
        [FromQuery] bool activeOnly = true)
    {
        var reservations = await _mongoDbService.GetReservationsForAdminAsync(status, type, activeOnly);
        var result = new List<object>();

        foreach (var r in reservations)
        {
            result.Add(await BuildAdminDtoAsync(r));
        }

        return Ok(result);
    }

    /// <summary>Dashboard counters: active holds, total deposits held, expiring in 48h.</summary>
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary()
    {
        var active = await _mongoDbService.GetReservationsForAdminAsync(activeOnly: true);
        var expiringSoon = await _mongoDbService.GetReservationsExpiringWithinAsync(
            TimeSpan.FromHours(48), onlyUnnotified: false);
        var depositsHeld = await _mongoDbService.GetTotalDepositsHeldAsync();
        var needsReview = await _mongoDbService.GetReservationsNeedingReviewAsync();

        return Ok(new
        {
            active_holds = active.Count,
            deposits_held = depositsHeld,
            expiring_48h = expiringSoon.Count,
            needs_review = needsReview.Count,
            unassigned = active.Count(r => r.IsUnassigned)
        });
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetReservation(string id)
    {
        var reservation = await _mongoDbService.GetReservationByIdAsync(id);
        if (reservation == null) return NotFound(new { error = "Reservation not found" });

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>
    /// Mark a listing pending. Fails cleanly if the listing already has an active
    /// reservation (the unique index resolves the two-admins-at-once race).
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> CreateReservation([FromBody] CreateReservationRequest request)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        if (listing == null) return NotFound(new { error = "Listing not found" });

        if (listing.Disabled)
        {
            return BadRequest(new { error = "This listing is already sold and cannot be reserved." });
        }

        var existing = await _mongoDbService.GetActiveReservationByListingAsync(request.ListingId);
        if (existing != null)
        {
            return Conflict(new
            {
                error = "This listing already has an active reservation.",
                existing = await BuildAdminDtoAsync(existing)
            });
        }

        if (!ReservationType.IsValid(request.Type))
        {
            return BadRequest(new { error = $"Unknown reservation type '{request.Type}'." });
        }

        var user = await _mongoDbService.GetUserByIdAsync(request.UserId);
        if (user == null) return BadRequest(new { error = "Reserved user not found." });

        var agreedPrice = request.AgreedPrice > 0 ? request.AgreedPrice : listing.Price;
        var tradeInCredit = request.Type == ReservationType.TradeIn ? request.TradeInCredit : 0m;

        var validation = ValidateTerms(agreedPrice, tradeInCredit, request.DepositRequired, request.DepositAmount);
        if (validation != null) return BadRequest(new { error = validation });

        var reservation = new Reservation
        {
            ListingId = request.ListingId,
            UserId = request.UserId,
            Type = request.Type,
            Status = ReservationStatus.Pending,
            AgreedPrice = agreedPrice,
            TradeInCredit = tradeInCredit,
            DepositRequired = request.DepositRequired,
            DepositAmount = request.DepositRequired ? request.DepositAmount : 0m,
            DepositRefundable = request.DepositRefundable,
            ExpiresAt = request.NoExpiration
                ? null
                : request.ExpiresAt ?? DateTime.UtcNow.AddDays(ReservationType.DefaultExpiryDays(request.Type)),
            InternalNote = request.InternalNote
        };

        try
        {
            await _mongoDbService.CreateReservationAsync(reservation);
        }
        catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
        {
            // Lost the race to another admin between our check and our insert.
            var winner = await _mongoDbService.GetActiveReservationByListingAsync(request.ListingId);
            return Conflict(new
            {
                error = "This listing was just reserved by someone else.",
                existing = winner != null ? await BuildAdminDtoAsync(winner) : null
            });
        }

        // No deposit required means the hold is immediately good — lock it into their cart
        // so it behaves the same as a deposit-paid hold from the customer's point of view.
        if (!reservation.DepositRequired)
        {
            await _reservationService.LockIntoCartAsync(reservation, listing);
        }

        if (user.Email != null)
        {
            await _emailService.SendReservationCreatedAsync(
                user.Email, listing.ListingTitle, listing.Id!, reservation.Id!,
                reservation.AgreedPrice, reservation.TradeInCredit,
                reservation.DepositRequired, reservation.DepositAmount,
                reservation.DepositRefundable, reservation.ExpiresAt);
        }

        _logger.LogInformation("Admin reserved listing {ListingId} for user {UserId}", request.ListingId, request.UserId);

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>
    /// Edit terms: agreed price, deposit, expiry, note, or reassign to a different user.
    /// Editing terms after a deposit is deliberate and allowed — the balance recomputes
    /// from these values, never from the live listing price.
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateReservation(string id, [FromBody] UpdateReservationRequest request)
    {
        var reservation = await _mongoDbService.GetReservationByIdAsync(id);
        if (reservation == null) return NotFound(new { error = "Reservation not found" });

        if (request.AgreedPrice.HasValue) reservation.AgreedPrice = request.AgreedPrice.Value;
        if (request.TradeInCredit.HasValue) reservation.TradeInCredit = request.TradeInCredit.Value;
        if (request.DepositRequired.HasValue) reservation.DepositRequired = request.DepositRequired.Value;
        if (request.DepositAmount.HasValue) reservation.DepositAmount = request.DepositAmount.Value;
        if (request.DepositRefundable.HasValue) reservation.DepositRefundable = request.DepositRefundable.Value;
        if (request.InternalNote != null) reservation.InternalNote = request.InternalNote;

        if (request.NoExpiration == true) reservation.ExpiresAt = null;
        else if (request.ExpiresAt.HasValue) reservation.ExpiresAt = request.ExpiresAt.Value;

        var reassigned = false;
        if (!string.IsNullOrEmpty(request.UserId) && request.UserId != reservation.UserId)
        {
            var newUser = await _mongoDbService.GetUserByIdAsync(request.UserId);
            if (newUser == null) return BadRequest(new { error = "Reserved user not found." });

            // Clear the old holder's locked cart line before moving the hold.
            await _reservationService.ReleaseCartLockAsync(reservation);
            reservation.UserId = request.UserId;
            reservation.NeedsReview = false;
            reservation.NeedsReviewReason = null;
            reassigned = true;
        }

        var validation = ValidateTerms(
            reservation.AgreedPrice, reservation.TradeInCredit,
            reservation.DepositRequired, reservation.DepositAmount);
        if (validation != null) return BadRequest(new { error = validation });

        await _mongoDbService.ReplaceReservationAsync(reservation);

        // Re-lock so the cart line reflects the new balance.
        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        if (listing != null && !reservation.IsUnassigned &&
            (reservation.Status == ReservationStatus.DepositPaid || !reservation.DepositRequired))
        {
            await _reservationService.LockIntoCartAsync(reservation, listing);
        }

        if (reassigned && listing != null)
        {
            var newUser = await _mongoDbService.GetUserByIdAsync(reservation.UserId!);
            if (newUser?.Email != null)
            {
                await _emailService.SendReservationCreatedAsync(
                    newUser.Email, listing.ListingTitle, listing.Id!, reservation.Id!,
                    reservation.AgreedPrice, reservation.TradeInCredit,
                    reservation.DepositRequired, reservation.DepositAmount,
                    reservation.DepositRefundable, reservation.ExpiresAt);
            }
        }

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>Quick +7 / +14 / +30 day extension. Re-notifies the customer.</summary>
    [HttpPost("{id}/extend")]
    public async Task<IActionResult> ExtendReservation(string id, [FromBody] ExtendReservationRequest request)
    {
        var reservation = await _mongoDbService.GetReservationByIdAsync(id);
        if (reservation == null) return NotFound(new { error = "Reservation not found" });

        if (request.Days <= 0) return BadRequest(new { error = "Days must be positive." });

        // Extend from now when already lapsed, otherwise from the existing expiry.
        var basis = reservation.ExpiresAt.HasValue && reservation.ExpiresAt.Value > DateTime.UtcNow
            ? reservation.ExpiresAt.Value
            : DateTime.UtcNow;

        reservation.ExpiresAt = basis.AddDays(request.Days);

        // Reinstating an expired hold puts it back in play.
        if (reservation.Status == ReservationStatus.Expired)
        {
            reservation.Status = reservation.DepositPaidAmount > 0
                ? ReservationStatus.DepositPaid
                : ReservationStatus.Pending;
        }

        // Fresh window means the customer should get a fresh warning.
        reservation.ExpiringSoonNotifiedAt = null;
        reservation.NeedsReview = false;
        reservation.NeedsReviewReason = null;

        await _mongoDbService.ReplaceReservationAsync(reservation);

        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        if (listing != null && !reservation.IsUnassigned)
        {
            // Restore the cart lock if reinstating brought it back to life.
            if (reservation.Status == ReservationStatus.DepositPaid || !reservation.DepositRequired)
            {
                await _reservationService.LockIntoCartAsync(reservation, listing);
            }

            var user = await _mongoDbService.GetUserByIdAsync(reservation.UserId!);
            if (user?.Email != null)
            {
                await _emailService.SendReservationCreatedAsync(
                    user.Email, listing.ListingTitle, listing.Id!, reservation.Id!,
                    reservation.AgreedPrice, reservation.TradeInCredit,
                    reservation.DepositRequired && reservation.DepositPaidAmount <= 0,
                    reservation.DepositAmount, reservation.DepositRefundable, reservation.ExpiresAt);
            }
        }

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>
    /// Record a deposit taken outside the site (cash, Venmo, Zelle, in person).
    /// Goes through the exact same path as an online deposit, so the lock-into-cart
    /// behaviour is identical by construction.
    /// </summary>
    [HttpPost("{id}/mark-deposit-paid")]
    public async Task<IActionResult> MarkDepositPaid(string id, [FromBody] MarkDepositPaidRequest request)
    {
        var reservation = await _mongoDbService.GetReservationByIdAsync(id);
        if (reservation == null) return NotFound(new { error = "Reservation not found" });

        if (reservation.IsUnassigned)
        {
            return BadRequest(new { error = "Assign a customer to this reservation before recording a deposit." });
        }

        if (request.Amount <= 0) return BadRequest(new { error = "Deposit amount must be greater than $0." });
        if (request.Amount > reservation.AgreedPrice - reservation.TradeInCredit)
        {
            return BadRequest(new { error = "Deposit cannot exceed the agreed price minus trade-in credit." });
        }

        var method = string.IsNullOrWhiteSpace(request.Method) ? "manual" : request.Method.Trim();

        var recorded = await _reservationService.RecordDepositPaidAsync(
            reservation, request.Amount, method, orderId: null, paidAt: request.PaidAt);

        if (!recorded)
        {
            return Conflict(new
            {
                error = "A deposit is already recorded on this reservation. Flagged for review instead of double-counting."
            });
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        var user = await _mongoDbService.GetUserByIdAsync(reservation.UserId!);

        if (user?.Email != null && listing != null)
        {
            await _emailService.SendDepositReceivedAsync(
                user.Email, listing.ListingTitle, reservation.DepositPaidAmount,
                reservation.BalanceDue, reservation.DepositRefundable, reservation.ExpiresAt);
        }

        await _emailService.SendDepositPaidAdminNotificationAsync(
            listing?.ListingTitle ?? "a listing",
            user?.FullName ?? "Unknown",
            user?.Email ?? "",
            reservation.DepositPaidAmount,
            reservation.BalanceDue,
            method);

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>
    /// Cancel a reservation. Releases the listing and clears the customer's locked cart line.
    /// Deposits are never refunded automatically — that happens by hand in Stripe/PayPal.
    /// </summary>
    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> CancelReservation(string id, [FromBody] CancelReservationRequest request)
    {
        var reservation = await _mongoDbService.GetReservationByIdAsync(id);
        if (reservation == null) return NotFound(new { error = "Reservation not found" });

        if (!ReservationCancellationReason.IsValid(request.Reason))
        {
            return BadRequest(new { error = "A cancellation reason is required." });
        }

        // Cancelling a paid hold requires explicit acknowledgement that the refund is manual.
        if (reservation.DepositPaidAmount > 0 && !request.AcknowledgeManualRefund)
        {
            return BadRequest(new
            {
                error = "refund_acknowledgement_required",
                message = $"A ${reservation.DepositPaidAmount:N2} deposit was paid on this reservation. " +
                          "Cancelling does NOT automatically refund it — you'll need to issue the refund manually. " +
                          "Resend with acknowledgeManualRefund set to true to continue.",
                deposit_paid = reservation.DepositPaidAmount
            });
        }

        await _reservationService.CancelReservationAsync(reservation, request.Reason, request.Note);

        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        if (!reservation.IsUnassigned)
        {
            var user = await _mongoDbService.GetUserByIdAsync(reservation.UserId!);
            if (user?.Email != null)
            {
                await _emailService.SendReservationCancelledAsync(
                    user.Email, listing?.ListingTitle ?? "a listing");
            }
        }

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>Sold in person: complete the reservation without an online checkout.</summary>
    [HttpPost("{id}/convert-to-sale")]
    public async Task<IActionResult> ConvertToSale(string id)
    {
        var reservation = await _mongoDbService.GetReservationByIdAsync(id);
        if (reservation == null) return NotFound(new { error = "Reservation not found" });

        await _reservationService.CompleteReservationAsync(reservation, finalOrderId: null);

        // Same "sold" bookkeeping the online checkout does.
        await _mongoDbService.DisableListingsByIdsAsync(new[] { reservation.ListingId });
        await _mongoDbService.MarkListingsSoldInTransactionsAsync(
            new[] { reservation.ListingId }, DateTime.UtcNow);

        _logger.LogInformation("Reservation {Id} converted to an in-person sale", id);

        return Ok(await BuildAdminDtoAsync(reservation));
    }

    /// <summary>
    /// One-time migration: every listing still flagged with the legacy Pending boolean
    /// becomes an unassigned Trade-In reservation. Unassigned holds block checkout for
    /// everyone until a customer is assigned, which is the safe default.
    /// </summary>
    [HttpPost("migrate-legacy-pending")]
    public async Task<IActionResult> MigrateLegacyPending()
    {
        var legacy = await _mongoDbService.GetLegacyPendingListingsAsync();
        var created = 0;
        var skipped = 0;
        var errors = new List<string>();

        foreach (var listing in legacy)
        {
            try
            {
                var existing = await _mongoDbService.GetActiveReservationByListingAsync(listing.Id!);
                if (existing != null)
                {
                    skipped++;
                    await _mongoDbService.ClearLegacyPendingFlagAsync(listing.Id!);
                    continue;
                }

                var reservation = new Reservation
                {
                    ListingId = listing.Id!,
                    UserId = null,               // unassigned — needs the admin to pick a customer
                    Type = ReservationType.TradeIn,
                    Status = ReservationStatus.Pending,
                    AgreedPrice = listing.Price,
                    TradeInCredit = 0m,
                    DepositRequired = false,
                    DepositAmount = 0m,
                    ExpiresAt = null,            // no expiration, per the migration spec
                    InternalNote = "Migrated from the legacy \"Pending for Trade-In\" flag. Assign a customer."
                };

                await _mongoDbService.CreateReservationAsync(reservation);
                await _mongoDbService.ClearLegacyPendingFlagAsync(listing.Id!);
                created++;
            }
            catch (Exception ex)
            {
                errors.Add($"{listing.Id}: {ex.Message}");
                _logger.LogError(ex, "Failed migrating legacy pending listing {ListingId}", listing.Id);
            }
        }

        _logger.LogInformation(
            "Legacy pending migration: {Created} created, {Skipped} skipped, {Errors} errors",
            created, skipped, errors.Count);

        return Ok(new
        {
            success = true,
            found = legacy.Count,
            created,
            skipped,
            errors
        });
    }

    // ---------------- helpers ----------------

    /// <summary>
    /// Shared validation for reservation terms. Returns an error string, or null when valid.
    /// </summary>
    private static string? ValidateTerms(
        decimal agreedPrice, decimal tradeInCredit, bool depositRequired, decimal depositAmount)
    {
        if (agreedPrice <= 0)
        {
            return "Agreed price must be greater than $0.";
        }

        if (tradeInCredit < 0)
        {
            return "Trade-in credit cannot be negative.";
        }

        if (tradeInCredit > agreedPrice)
        {
            return "Trade-in credit cannot exceed the agreed price.";
        }

        if (depositRequired)
        {
            if (depositAmount <= 0)
            {
                return "Deposit amount must be greater than $0.";
            }

            if (depositAmount > agreedPrice - tradeInCredit)
            {
                return "Deposit cannot exceed the agreed price minus trade-in credit.";
            }
        }

        return null;
    }

    /// <summary>
    /// Admin view of a reservation. Includes the holder's identity and the internal note —
    /// this shape must never be returned from a public or customer-facing endpoint.
    /// </summary>
    private async Task<object> BuildAdminDtoAsync(Reservation r)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(r.ListingId);
        var user = r.IsUnassigned ? null : await _mongoDbService.GetUserByIdAsync(r.UserId!);

        return new
        {
            id = r.Id,
            listing_id = r.ListingId,
            listing_title = listing?.ListingTitle ?? "(listing removed)",
            listing_image = listing?.Images.FirstOrDefault(),
            listing_price = listing?.Price,
            listing_sold = listing?.Disabled ?? false,

            type = r.Type,
            type_label = ReservationType.Label(r.Type),
            status = r.Status,
            status_label = ReservationStatus.Label(r.Status),

            user_id = r.UserId,
            user_name = user?.FullName,
            user_email = user?.Email,
            is_unassigned = r.IsUnassigned,
            // The reserved account was deleted or disabled — needs an admin decision.
            user_missing = !r.IsUnassigned && user == null,

            agreed_price = r.AgreedPrice,
            trade_in_credit = r.TradeInCredit,
            deposit_required = r.DepositRequired,
            deposit_amount = r.DepositAmount,
            deposit_refundable = r.DepositRefundable,
            deposit_paid_amount = r.DepositPaidAmount,
            deposit_paid_at = r.DepositPaidAt,
            deposit_payment_method = r.DepositPaymentMethod,
            deposit_order_id = r.DepositOrderId,
            final_order_id = r.FinalOrderId,
            balance_due = r.BalanceDue,
            is_over_credited = r.IsOverCredited,

            expires_at = r.ExpiresAt,
            is_expired = r.IsExpired,
            internal_note = r.InternalNote,
            cancellation_reason = r.CancellationReason,
            needs_review = r.NeedsReview,
            needs_review_reason = r.NeedsReviewReason,
            source_conversation_id = r.SourceConversationId,

            created_at = r.CreatedAt,
            updated_at = r.UpdatedAt,
            completed_at = r.CompletedAt
        };
    }
}

// ---------------- request bodies ----------------

public class CreateReservationRequest
{
    public string ListingId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Type { get; set; } = ReservationType.Hold;
    public decimal AgreedPrice { get; set; }
    public decimal TradeInCredit { get; set; }
    public bool DepositRequired { get; set; }
    public decimal DepositAmount { get; set; }
    public bool DepositRefundable { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool NoExpiration { get; set; }
    public string? InternalNote { get; set; }
}

public class UpdateReservationRequest
{
    public string? UserId { get; set; }
    public decimal? AgreedPrice { get; set; }
    public decimal? TradeInCredit { get; set; }
    public bool? DepositRequired { get; set; }
    public decimal? DepositAmount { get; set; }
    public bool? DepositRefundable { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool? NoExpiration { get; set; }
    public string? InternalNote { get; set; }
}

public class ExtendReservationRequest
{
    public int Days { get; set; }
}

public class MarkDepositPaidRequest
{
    public decimal Amount { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? Method { get; set; }
}

public class CancelReservationRequest
{
    public string Reason { get; set; } = string.Empty;
    public string? Note { get; set; }
    public bool AcknowledgeManualRefund { get; set; }
}
