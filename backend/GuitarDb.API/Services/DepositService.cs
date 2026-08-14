using GuitarDb.API.Models;
using Stripe.Checkout;

namespace GuitarDb.API.Services;

/// <summary>
/// Records deposit payments against reservations.
///
/// Shared by the deposit checkout controller (the normal redirect path) and by the
/// Stripe webhook fallback, so a deposit is settled exactly the same way regardless of
/// which one gets there first. Every entry point is idempotent.
/// </summary>
public class DepositService
{
    private readonly MongoDbService _mongoDbService;
    private readonly ReservationService _reservationService;
    private readonly EmailService _emailService;
    private readonly ILogger<DepositService> _logger;

    public DepositService(
        MongoDbService mongoDbService,
        ReservationService reservationService,
        EmailService emailService,
        ILogger<DepositService> logger)
    {
        _mongoDbService = mongoDbService;
        _reservationService = reservationService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Records a paid Stripe deposit session. Safe to call twice — the second call
    /// returns the order the first one wrote rather than charging or recording again.
    /// </summary>
    public async Task<Order?> SettleStripeDepositSessionAsync(Session session, string reservationId)
    {
        var existing = await _mongoDbService.GetOrderBySessionIdAsync(session.Id);
        if (existing != null)
        {
            _logger.LogInformation(
                "Deposit session {SessionId} already recorded as order {OrderId}", session.Id, existing.Id);
            return existing;
        }

        var reservation = await _mongoDbService.GetReservationByIdAsync(reservationId);
        if (reservation == null)
        {
            _logger.LogError(
                "Deposit session {SessionId} references unknown reservation {ReservationId}",
                session.Id, reservationId);
            return null;
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        if (listing == null)
        {
            _logger.LogError(
                "Deposit session {SessionId} references unknown listing {ListingId}",
                session.Id, reservation.ListingId);
            return null;
        }

        var order = await CreateDepositOrderAsync(
            reservation, listing,
            paymentMethod: "stripe",
            stripeSessionId: session.Id,
            stripePaymentIntentId: session.PaymentIntentId,
            payPalOrderId: null,
            payPalCaptureId: null);

        await ApplyDepositAndNotifyAsync(reservation, listing, order, "card");

        return order;
    }

    /// <summary>
    /// Writes the deposit order. Tagged OrderType.Deposit and linked to the reservation
    /// so reporting can tell a partial payment apart from a sale.
    /// </summary>
    public async Task<Order> CreateDepositOrderAsync(
        Reservation reservation,
        MyListing listing,
        string paymentMethod,
        string? stripeSessionId,
        string? stripePaymentIntentId,
        string? payPalOrderId,
        string? payPalCaptureId)
    {
        var order = new Order
        {
            OrderType = OrderType.Deposit,
            PaymentMethod = paymentMethod,
            StripeSessionId = stripeSessionId,
            StripePaymentIntentId = stripePaymentIntentId,
            PayPalOrderId = payPalOrderId,
            PayPalCaptureId = payPalCaptureId,
            Items = new List<OrderItem>
            {
                new OrderItem
                {
                    ListingId = listing.Id!,
                    ListingTitle = $"Deposit — {listing.ListingTitle}",
                    Price = reservation.DepositAmount,
                    Currency = listing.Currency,
                    Quantity = 1
                }
            },
            // Deposits collect no address; an empty one satisfies the required field.
            ShippingAddress = new OrderShippingAddress(),
            TotalAmount = reservation.DepositAmount,
            Currency = listing.Currency,
            Status = "completed",
            UserId = reservation.UserId,
            ReservationIds = new List<string> { reservation.Id! }
        };

        await _mongoDbService.CreateOrderAsync(order);
        _logger.LogInformation(
            "Created deposit order {OrderId} ({Amount:C}) for reservation {ReservationId}",
            order.Id, order.TotalAmount, reservation.Id);

        return order;
    }

    /// <summary>
    /// Applies the deposit to the reservation — which locks the guitar into the
    /// customer's cart — and sends the customer receipt plus the admin notification.
    /// </summary>
    public async Task ApplyDepositAndNotifyAsync(
        Reservation reservation, MyListing listing, Order order, string methodLabel)
    {
        var recorded = await _reservationService.RecordDepositPaidAsync(
            reservation, order.TotalAmount, methodLabel, order.Id);

        if (!recorded)
        {
            // Duplicate deposit — already flagged for review inside RecordDepositPaidAsync.
            _logger.LogWarning(
                "Deposit order {OrderId} recorded but reservation {ReservationId} already had a deposit",
                order.Id, reservation.Id);
            return;
        }

        if (!string.IsNullOrEmpty(reservation.UserId))
        {
            await _mongoDbService.LogActivityAsync(
                reservation.UserId, "deposit_paid",
                $"Paid a ${order.TotalAmount:N2} deposit on {listing.ListingTitle}");
        }

        var user = reservation.IsUnassigned
            ? null
            : await _mongoDbService.GetUserByIdAsync(reservation.UserId!);

        if (user?.Email != null)
        {
            await _emailService.SendDepositReceivedAsync(
                user.Email, listing.ListingTitle, reservation.DepositPaidAmount,
                reservation.BalanceDue, reservation.DepositRefundable, reservation.ExpiresAt);
        }

        await _emailService.SendDepositPaidAdminNotificationAsync(
            listing.ListingTitle,
            user?.FullName ?? "Unknown",
            user?.Email ?? "",
            reservation.DepositPaidAmount,
            reservation.BalanceDue,
            methodLabel);
    }
}
