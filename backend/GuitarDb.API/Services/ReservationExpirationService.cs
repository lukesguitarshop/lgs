using GuitarDb.API.Models;

namespace GuitarDb.API.Services;

/// <summary>
/// Hourly sweep over reservations.
///
/// The critical asymmetry: a Pending hold (no money) is released automatically, but a
/// DepositPaid hold is NEVER auto-released — money changed hands, so it gets flagged for
/// the admin to decide. Nothing here deletes a reservation; expiry is a status change,
/// so the financial paper trail survives permanently.
/// </summary>
public class ReservationExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ReservationExpirationService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromHours(1);

    /// <summary>Customers get one warning this far ahead of expiry.</summary>
    private static readonly TimeSpan WarningWindow = TimeSpan.FromHours(48);

    /// <summary>Admin digest is sent at most once per this interval.</summary>
    private static readonly TimeSpan DigestInterval = TimeSpan.FromHours(24);

    private DateTime _lastDigestSentUtc = DateTime.MinValue;

    public ReservationExpirationService(
        IServiceProvider serviceProvider,
        ILogger<ReservationExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Reservation Expiration Service starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredReservationsAsync();
                await SendExpiringSoonWarningsAsync();
                await SendAdminDigestIfDueAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in reservation expiration sweep");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task ProcessExpiredReservationsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<MongoDbService>();
        var email = scope.ServiceProvider.GetRequiredService<EmailService>();
        var reservations = scope.ServiceProvider.GetRequiredService<ReservationService>();

        var expired = await mongo.GetExpiredActiveReservationsAsync();
        if (expired.Count == 0) return;

        _logger.LogInformation("Processing {Count} expired reservation(s)", expired.Count);

        foreach (var reservation in expired)
        {
            try
            {
                var listing = await mongo.GetMyListingByIdAsync(reservation.ListingId);
                var listingTitle = listing?.ListingTitle ?? "a listing";
                var user = reservation.IsUnassigned
                    ? null
                    : await mongo.GetUserByIdAsync(reservation.UserId!);

                if (reservation.Status == ReservationStatus.DepositPaid)
                {
                    // Money changed hands. Do NOT release. Flag it and let the admin decide
                    // whether to extend, refund, or keep the deposit.
                    if (reservation.NeedsReview)
                    {
                        continue; // already flagged, don't re-notify every hour
                    }

                    await mongo.FlagReservationForReviewAsync(
                        reservation.Id!,
                        $"Expired {reservation.ExpiresAt:yyyy-MM-dd} with {reservation.DepositPaidAmount:C} deposit paid. " +
                        "Listing NOT released — decide whether to extend, refund, or keep the deposit.");

                    await email.SendReservationNeedsReviewAdminAsync(
                        listingTitle,
                        user?.FullName ?? "(unassigned)",
                        reservation.DepositPaidAmount,
                        "Hold expired while a deposit was held.");

                    _logger.LogWarning(
                        "Reservation {Id} expired WITH a {Amount:C} deposit — flagged for review, listing left reserved",
                        reservation.Id, reservation.DepositPaidAmount);

                    continue;
                }

                // Pending, no money paid: release it.
                await mongo.SetReservationStatusAsync(reservation.Id!, ReservationStatus.Expired);
                await reservations.ReleaseCartLockAsync(reservation);

                if (user?.Email != null)
                {
                    await email.SendReservationExpiredAsync(user.Email, listingTitle);
                }

                _logger.LogInformation(
                    "Reservation {Id} expired and listing {ListingId} released",
                    reservation.Id, reservation.ListingId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error expiring reservation {Id}", reservation.Id);
            }
        }
    }

    private async Task SendExpiringSoonWarningsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<MongoDbService>();
        var email = scope.ServiceProvider.GetRequiredService<EmailService>();

        var soon = await mongo.GetReservationsExpiringWithinAsync(WarningWindow, onlyUnnotified: true);
        if (soon.Count == 0) return;

        foreach (var reservation in soon)
        {
            try
            {
                if (reservation.IsUnassigned) continue;

                var user = await mongo.GetUserByIdAsync(reservation.UserId!);
                if (user?.Email == null) continue;

                var listing = await mongo.GetMyListingByIdAsync(reservation.ListingId);

                await email.SendReservationExpiringSoonAsync(
                    user.Email,
                    listing?.ListingTitle ?? "a listing",
                    reservation.Id!,
                    reservation.BalanceDue,
                    depositUnpaid: reservation.DepositRequired && reservation.DepositPaidAmount <= 0,
                    reservation.DepositAmount,
                    reservation.ExpiresAt!.Value);

                await mongo.MarkReservationExpiringSoonNotifiedAsync(reservation.Id!);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending expiring-soon warning for reservation {Id}", reservation.Id);
            }
        }
    }

    private async Task SendAdminDigestIfDueAsync()
    {
        if (DateTime.UtcNow - _lastDigestSentUtc < DigestInterval) return;

        using var scope = _serviceProvider.CreateScope();
        var mongo = scope.ServiceProvider.GetRequiredService<MongoDbService>();
        var email = scope.ServiceProvider.GetRequiredService<EmailService>();

        // Digest covers everything in the window, notified or not.
        var soon = await mongo.GetReservationsExpiringWithinAsync(WarningWindow, onlyUnnotified: false);
        if (soon.Count == 0)
        {
            _lastDigestSentUtc = DateTime.UtcNow;
            return;
        }

        var rows = new List<(string, string, DateTime?, decimal)>();
        foreach (var reservation in soon)
        {
            var listing = await mongo.GetMyListingByIdAsync(reservation.ListingId);
            var user = reservation.IsUnassigned ? null : await mongo.GetUserByIdAsync(reservation.UserId!);
            rows.Add((
                listing?.ListingTitle ?? "a listing",
                user?.FullName ?? "(unassigned)",
                reservation.ExpiresAt,
                reservation.BalanceDue));
        }

        await email.SendExpiringHoldsDigestAsync(rows);
        _lastDigestSentUtc = DateTime.UtcNow;

        _logger.LogInformation("Sent admin digest for {Count} hold(s) expiring within 48h", rows.Count);
    }
}
