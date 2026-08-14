using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

/// <summary>
/// Why a purchase attempt was refused. Kept coarse on purpose: the public-facing
/// message must never reveal WHO a listing is held for.
/// </summary>
public enum ReservationBlockReason
{
    None = 0,
    ReservedForAnotherUser,
    RequiresLogin,
    Unassigned,
    Expired,
    ListingSold,
    ListingNotFound
}

/// <summary>
/// Result of asking "may this user buy this listing right now?".
/// </summary>
public class PurchaseEligibility
{
    public bool Allowed { get; init; }
    public ReservationBlockReason Reason { get; init; } = ReservationBlockReason.None;
    public string? Message { get; init; }
    public Reservation? Reservation { get; init; }

    public static PurchaseEligibility Allow(Reservation? reservation = null) =>
        new() { Allowed = true, Reservation = reservation };

    public static PurchaseEligibility Block(ReservationBlockReason reason, string message, Reservation? reservation = null) =>
        new() { Allowed = false, Reason = reason, Message = message, Reservation = reservation };
}

/// <summary>
/// The single place that answers "who is this guitar promised to, and what do they owe".
///
/// Every enforcement point (add-to-cart, checkout create, payment capture) and every
/// price calculation goes through here, so there is exactly one implementation of the
/// rule and no path that can be missed. Accepted offers use the same code by creating
/// a reservation of type OfferAccepted.
/// </summary>
public class ReservationService
{
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<ReservationService> _logger;

    /// <summary>Shown to anyone who is not the reserved user. Deliberately says nothing about who holds it.</summary>
    public const string GenericHoldMessage = "This guitar is currently on hold.";
    public const string GenericOfferMessage = "This guitar is currently on hold and not accepting offers.";

    public ReservationService(MongoDbService mongoDbService, ILogger<ReservationService> logger)
    {
        _mongoDbService = mongoDbService;
        _logger = logger;
    }

    // ---------------- Enforcement ----------------

    /// <summary>
    /// May <paramref name="userId"/> (null = logged out) buy this listing right now?
    /// Call at add-to-cart, at checkout-session creation, and again at payment capture.
    /// </summary>
    public async Task<PurchaseEligibility> CheckPurchaseEligibilityAsync(string listingId, string? userId)
    {
        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listingId);
        return EvaluateEligibility(reservation, userId);
    }

    /// <summary>
    /// Batch form for multi-item carts. Returns the first blocking result, or Allow if
    /// every listing is purchasable by this user.
    /// </summary>
    public async Task<PurchaseEligibility> CheckPurchaseEligibilityAsync(
        IEnumerable<string> listingIds, string? userId)
    {
        var ids = listingIds.Distinct().ToList();
        if (ids.Count == 0) return PurchaseEligibility.Allow();

        var reservations = await _mongoDbService.GetActiveReservationsByListingIdsAsync(ids);

        foreach (var id in ids)
        {
            reservations.TryGetValue(id, out var reservation);
            var result = EvaluateEligibility(reservation, userId);
            if (!result.Allowed) return result;
        }

        return PurchaseEligibility.Allow();
    }

    /// <summary>
    /// Pure decision function -- no I/O, so it is trivially testable and identical
    /// everywhere it is applied.
    /// </summary>
    public static PurchaseEligibility EvaluateEligibility(Reservation? reservation, string? userId)
    {
        // No active reservation: anyone may buy.
        if (reservation == null || !reservation.IsActive)
        {
            return PurchaseEligibility.Allow();
        }

        // Migrated-but-unassigned holds block everyone until an admin assigns a customer.
        // Safe default: better to block a sale than to sell something that is promised.
        if (reservation.IsUnassigned)
        {
            return PurchaseEligibility.Block(
                ReservationBlockReason.Unassigned,
                GenericHoldMessage,
                reservation);
        }

        // An expired hold stops being a licence to buy, even for the holder. The
        // background job will formalise it; this guards the window in between.
        if (reservation.IsExpired)
        {
            return userId == reservation.UserId
                ? PurchaseEligibility.Block(
                    ReservationBlockReason.Expired,
                    "This hold expired. Please contact us to reinstate it.",
                    reservation)
                : PurchaseEligibility.Block(
                    ReservationBlockReason.ReservedForAnotherUser,
                    GenericHoldMessage,
                    reservation);
        }

        if (string.IsNullOrEmpty(userId))
        {
            return PurchaseEligibility.Block(
                ReservationBlockReason.RequiresLogin,
                GenericHoldMessage,
                reservation);
        }

        if (userId != reservation.UserId)
        {
            return PurchaseEligibility.Block(
                ReservationBlockReason.ReservedForAnotherUser,
                GenericHoldMessage,
                reservation);
        }

        return PurchaseEligibility.Allow(reservation);
    }

    /// <summary>True when a new offer may be made on this listing.</summary>
    public async Task<bool> CanAcceptOffersAsync(string listingId)
    {
        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listingId);
        return reservation == null || !reservation.IsActive;
    }

    // ---------------- Pricing ----------------

    /// <summary>
    /// What the reserved user is charged for this listing at final checkout.
    /// ALWAYS computed here from the reservation's locked terms -- never from a price
    /// supplied by the browser, and never from the live listing price (which the admin
    /// may have edited after the deposit was taken).
    /// </summary>
    public static decimal CalculateBalanceDue(Reservation reservation) => reservation.BalanceDue;

    /// <summary>
    /// Effective charge for a listing for this user: the reservation balance when they
    /// hold it, otherwise the listing price. This is the only pricing path checkout uses.
    /// </summary>
    public static decimal ResolveChargeAmount(MyListing listing, Reservation? reservation, string? userId)
    {
        if (reservation != null
            && reservation.IsActive
            && !reservation.IsUnassigned
            && reservation.UserId == userId)
        {
            return reservation.BalanceDue;
        }

        return listing.Price;
    }

    // ---------------- Cart locking ----------------

    /// <summary>
    /// Locks the guitar into the reserved user's cart. Reuses the existing PendingCartItem
    /// mechanism (same locked-item behaviour as accepted offers) rather than building a
    /// parallel system.
    ///
    /// Deposit-backed locks are written with a NULL expiry so the TTL index can never
    /// delete a row that has money attached to it.
    /// </summary>
    public async Task<PendingCartItem?> LockIntoCartAsync(Reservation reservation, MyListing listing)
    {
        if (reservation.IsUnassigned)
        {
            _logger.LogWarning("Refusing to lock unassigned reservation {Id} into a cart", reservation.Id);
            return null;
        }

        // Clear any prior lock for this user+listing so retries do not stack duplicates.
        await _mongoDbService.DeletePendingCartItemByUserAndListingAsync(reservation.UserId!, reservation.ListingId);

        var item = new PendingCartItem
        {
            UserId = reservation.UserId!,
            ListingId = reservation.ListingId,
            OfferId = reservation.SourceConversationId ?? reservation.Id!,
            ReservationId = reservation.Id,
            Price = reservation.BalanceDue,
            DepositPaid = reservation.DepositPaidAmount,
            TradeInCredit = reservation.TradeInCredit,
            Currency = listing.Currency,
            ListingTitle = listing.ListingTitle,
            ListingImage = listing.Images.FirstOrDefault() ?? string.Empty,
            // Money attached => never auto-delete. Otherwise mirror the reservation's own expiry.
            ExpiresAt = reservation.DepositPaidAmount > 0 ? null : reservation.ExpiresAt
        };

        await _mongoDbService.CreatePendingCartItemAsync(item);
        _logger.LogInformation(
            "Locked listing {ListingId} into cart for user {UserId} (reservation {ReservationId}, balance {Balance:C})",
            reservation.ListingId, reservation.UserId, reservation.Id, item.Price);

        return item;
    }

    /// <summary>Removes the locked cart line — used on cancel, expire, and completion.</summary>
    public async Task ReleaseCartLockAsync(Reservation reservation)
    {
        if (reservation.IsUnassigned) return;
        await _mongoDbService.DeletePendingCartItemByUserAndListingAsync(
            reservation.UserId!, reservation.ListingId);
    }

    // ---------------- Lifecycle ----------------

    /// <summary>
    /// Records a paid deposit and locks the guitar into the reserved user's cart.
    /// Used identically by the online deposit checkout and by the admin's
    /// "mark deposit paid" action for cash/Venmo/Zelle, so behaviour cannot diverge.
    ///
    /// Returns false when the deposit was already recorded (double-click / retry guard).
    /// </summary>
    public async Task<bool> RecordDepositPaidAsync(
        Reservation reservation,
        decimal amount,
        string paymentMethod,
        string? orderId,
        DateTime? paidAt = null)
    {
        if (reservation.Status == ReservationStatus.DepositPaid && reservation.DepositPaidAmount > 0)
        {
            _logger.LogWarning(
                "Duplicate deposit on reservation {Id}: already has {Existing:C}, received another {Amount:C}. " +
                "Recording for review rather than double-counting.",
                reservation.Id, reservation.DepositPaidAmount, amount);

            await _mongoDbService.FlagReservationForReviewAsync(
                reservation.Id!,
                $"Possible double deposit: {reservation.DepositPaidAmount:C} already recorded, " +
                $"then {amount:C} via {paymentMethod} on {(paidAt ?? DateTime.UtcNow):yyyy-MM-dd}. Refund may be owed.");

            return false;
        }

        reservation.DepositPaidAmount = amount;
        reservation.DepositPaidAt = paidAt ?? DateTime.UtcNow;
        reservation.DepositPaymentMethod = paymentMethod;
        reservation.DepositOrderId = orderId;
        reservation.Status = ReservationStatus.DepositPaid;
        reservation.UpdatedAt = DateTime.UtcNow;

        // Credits exceeding the price is an admin problem, never an automatic refund.
        if (reservation.IsOverCredited)
        {
            reservation.NeedsReview = true;
            reservation.NeedsReviewReason =
                $"Credits ({reservation.DepositPaidAmount + reservation.TradeInCredit:C}) exceed " +
                $"agreed price ({reservation.AgreedPrice:C}). Balance floored at $0.";
        }

        await _mongoDbService.ReplaceReservationAsync(reservation);

        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        if (listing != null)
        {
            await LockIntoCartAsync(reservation, listing);
        }

        _logger.LogInformation(
            "Deposit of {Amount:C} recorded on reservation {Id} via {Method}; balance now {Balance:C}",
            amount, reservation.Id, paymentMethod, reservation.BalanceDue);

        return true;
    }

    /// <summary>
    /// Marks the reservation completed and links the final order. Called after a
    /// successful full purchase and by the admin's "convert to sale" action.
    /// </summary>
    public async Task CompleteReservationAsync(Reservation reservation, string? finalOrderId)
    {
        reservation.Status = ReservationStatus.Completed;
        reservation.FinalOrderId = finalOrderId;
        reservation.CompletedAt = DateTime.UtcNow;
        reservation.UpdatedAt = DateTime.UtcNow;

        await _mongoDbService.ReplaceReservationAsync(reservation);
        await ReleaseCartLockAsync(reservation);

        _logger.LogInformation("Reservation {Id} completed (order {OrderId})", reservation.Id, finalOrderId ?? "manual");
    }

    /// <summary>
    /// Cancels a reservation: releases the listing and clears the customer's locked cart line.
    /// Deposits are never refunded automatically — that is a manual action in Stripe/PayPal.
    /// </summary>
    public async Task CancelReservationAsync(Reservation reservation, string reason, string? note = null)
    {
        reservation.Status = ReservationStatus.Cancelled;
        reservation.CancellationReason = string.IsNullOrWhiteSpace(note) ? reason : $"{reason}: {note}";
        reservation.UpdatedAt = DateTime.UtcNow;

        // A cancelled hold that took money still needs a human to close the loop.
        if (reservation.DepositPaidAmount > 0)
        {
            reservation.NeedsReview = true;
            reservation.NeedsReviewReason =
                $"Cancelled with {reservation.DepositPaidAmount:C} deposit paid. Manual refund may be required.";
        }

        await _mongoDbService.ReplaceReservationAsync(reservation);
        await ReleaseCartLockAsync(reservation);

        _logger.LogInformation("Reservation {Id} cancelled ({Reason})", reservation.Id, reason);
    }

    /// <summary>
    /// Builds the customer-facing view of a reservation. Contains no admin note and no
    /// identity information — safe to return to the reserved user.
    /// </summary>
    public static object BuildReservedUserView(Reservation reservation, string currency = "USD")
    {
        return new
        {
            id = reservation.Id,
            type = reservation.Type,
            type_label = ReservationType.Label(reservation.Type),
            status = reservation.Status,
            status_label = ReservationStatus.Label(reservation.Status),
            agreed_price = reservation.AgreedPrice,
            trade_in_credit = reservation.TradeInCredit,
            deposit_required = reservation.DepositRequired,
            deposit_amount = reservation.DepositAmount,
            deposit_refundable = reservation.DepositRefundable,
            deposit_paid_amount = reservation.DepositPaidAmount,
            deposit_paid_at = reservation.DepositPaidAt,
            balance_due = reservation.BalanceDue,
            expires_at = reservation.ExpiresAt,
            currency
        };
    }

    /// <summary>
    /// Public view for everyone who is NOT the reserved user. Exposes only that a hold
    /// exists and what kind — never the holder's name, email, initials, or id.
    /// </summary>
    public static object BuildPublicView(Reservation reservation)
    {
        return new
        {
            is_reserved = true,
            type = reservation.Type,
            badge = ReservationType.PublicBadge(reservation.Type),
            message = GenericHoldMessage
        };
    }
}
