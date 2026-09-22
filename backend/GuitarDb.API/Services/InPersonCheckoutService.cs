using GuitarDb.API.Models;
using Stripe;
using Stripe.Checkout;

namespace GuitarDb.API.Services;

/// <summary>
/// The in-person sale: the admin picks a guitar, the buyer pays by card through the
/// ordinary Stripe Checkout on the admin's phone, and the order is written with no
/// account behind it.
///
/// Session creation and settlement both live here so the admin success page, the public
/// /checkout/complete endpoint and the Stripe webhook all record the sale identically.
/// Settlement is idempotent — whichever path gets there first writes the order and every
/// later call returns it.
/// </summary>
public class InPersonCheckoutService
{
    /// <summary>Marks the Stripe session so completion paths know which settlement applies.</summary>
    public const string OrderTypeMetadata = "in_person";

    private static readonly string[] ShippingCountries = { "US", "CA" };

    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<InPersonCheckoutService> _logger;

    public InPersonCheckoutService(
        MongoDbService mongoDbService,
        EmailService emailService,
        IConfiguration configuration,
        ILogger<InPersonCheckoutService> logger)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    private string FrontendUrl() =>
        (_configuration["FrontendUrl"] ?? "http://localhost:3000").TrimEnd('/');

    /// <summary>True when this Stripe session was created by the in-person tool.</summary>
    public static bool IsInPersonSession(Session session) =>
        session.Metadata != null
        && session.Metadata.TryGetValue("order_type", out var type)
        && type == OrderTypeMetadata;

    /// <summary>
    /// Builds the Stripe Checkout session for one guitar at the agreed price.
    /// </summary>
    /// <param name="listing">The guitar being sold. Must be active.</param>
    /// <param name="price">The price the admin agreed with the buyer. Validated by the caller.</param>
    /// <param name="fulfillment">OrderFulfillment.HandedOver or OrderFulfillment.Ship.</param>
    /// <param name="adminUserId">Who is ringing up the sale.</param>
    /// <param name="note">Anything the admin wants remembered on the order.</param>
    public async Task<Session> CreateSessionAsync(
        MyListing listing, decimal price, string fulfillment, string adminUserId, string? note)
    {
        StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];

        var shipping = fulfillment == OrderFulfillment.Ship;
        var currency = listing.Currency.ToLower();

        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = new List<string> { "card" },
            Mode = "payment",
            LineItems = new List<SessionLineItemOptions>
            {
                new SessionLineItemOptions
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = currency,
                        UnitAmount = (long)Math.Round(price * 100, MidpointRounding.AwayFromZero),
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = listing.ListingTitle,
                            Description = string.IsNullOrWhiteSpace(listing.Condition)
                                ? "In-store purchase"
                                : $"{listing.Condition} — in-store purchase",
                            Images = listing.Images.Take(1).ToList()
                        }
                    },
                    Quantity = 1
                }
            },
            // The buyer has no account, so Stripe is the only place we can ask for a way to
            // reach them. Email is always collected; the phone is the extra.
            PhoneNumberCollection = new SessionPhoneNumberCollectionOptions { Enabled = true },
            // Back to the admin's own browser on the same origin the admin signed in on.
            SuccessUrl = $"{FrontendUrl()}/admin/in-person/success?session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = $"{FrontendUrl()}/admin/other-tools?tab=in-person&cancelled=1",
            Metadata = new Dictionary<string, string>
            {
                { "order_type", OrderTypeMetadata },
                { "listing_ids", listing.Id! },
                { "agreed_price", price.ToString("F2") },
                { "fulfillment", fulfillment },
                { "admin_user_id", adminUserId },
                { "note", Truncate(note ?? "", 450) }
            }
        };

        if (shipping)
        {
            // The buyer types their own address on the Stripe page; the site's free
            // insured shipping applies just as it does on a web order.
            options.ShippingAddressCollection = new SessionShippingAddressCollectionOptions
            {
                AllowedCountries = ShippingCountries.ToList()
            };
            options.ShippingOptions = new List<SessionShippingOptionOptions>
            {
                new SessionShippingOptionOptions
                {
                    ShippingRateData = new SessionShippingOptionShippingRateDataOptions
                    {
                        Type = "fixed_amount",
                        FixedAmount = new SessionShippingOptionShippingRateDataFixedAmountOptions
                        {
                            Amount = 0,
                            Currency = currency
                        },
                        DisplayName = "Free Shipping"
                    }
                }
            };
        }

        var session = await new SessionService().CreateAsync(options);

        _logger.LogInformation(
            "Created in-person checkout session {SessionId} for listing {ListingId} at {Price} ({Fulfillment}) by admin {AdminId}",
            session.Id, listing.Id, price, fulfillment, adminUserId);

        return session;
    }

    /// <summary>
    /// Records a paid in-person session as an order and runs every side effect a sale
    /// carries. Safe to call from more than one place: the first call writes, the rest
    /// return what was written.
    /// </summary>
    /// <param name="session">The session, expanded with payment_intent.</param>
    /// <returns>The order, or null when the session cannot be recorded.</returns>
    public async Task<Order?> SettleSessionAsync(Session session)
    {
        var existing = await _mongoDbService.GetOrderBySessionIdAsync(session.Id);
        if (existing != null)
        {
            _logger.LogInformation(
                "In-person session {SessionId} already recorded as order {OrderId}", session.Id, existing.Id);
            return existing;
        }

        if (session.PaymentStatus != "paid")
        {
            _logger.LogWarning("In-person session {SessionId} is not paid ({Status})", session.Id, session.PaymentStatus);
            return null;
        }

        if (!session.Metadata.TryGetValue("listing_ids", out var listingId) || string.IsNullOrEmpty(listingId))
        {
            _logger.LogError("In-person session {SessionId} carries no listing id", session.Id);
            return null;
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(listingId);
        if (listing == null)
        {
            _logger.LogError("In-person session {SessionId} references unknown listing {ListingId}", session.Id, listingId);
            return null;
        }

        // The price is what Stripe actually charged, not what the listing says now. The
        // metadata copy is the fallback for the unlikely case the amount is missing.
        session.Metadata.TryGetValue("agreed_price", out var agreedPriceString);
        decimal.TryParse(agreedPriceString, System.Globalization.NumberStyles.Any,
            System.Globalization.CultureInfo.InvariantCulture, out var agreedPrice);
        var charged = session.AmountTotal.HasValue ? session.AmountTotal.Value / 100m : agreedPrice;

        session.Metadata.TryGetValue("fulfillment", out var fulfillment);
        if (!OrderFulfillment.IsValid(fulfillment)) fulfillment = OrderFulfillment.HandedOver;
        var handedOver = fulfillment == OrderFulfillment.HandedOver;

        session.Metadata.TryGetValue("admin_user_id", out var adminUserId);
        session.Metadata.TryGetValue("note", out var note);

        var customer = session.CustomerDetails;
        var shippingAddress = ReadShippingAddress(session, customer, handedOver);

        var now = DateTime.UtcNow;
        var order = new Order
        {
            PaymentMethod = "stripe",
            Source = OrderSource.InPerson,
            Fulfillment = fulfillment!,
            StripeSessionId = session.Id,
            StripePaymentIntentId = session.PaymentIntent?.Id ?? session.PaymentIntentId,
            Items = new List<OrderItem>
            {
                new OrderItem
                {
                    ListingId = listing.Id!,
                    ListingTitle = listing.ListingTitle,
                    Price = charged,
                    Currency = listing.Currency,
                    Quantity = 1
                }
            },
            ShippingAddress = shippingAddress,
            TotalAmount = charged,
            Currency = listing.Currency,
            // A guitar that left with the buyer is delivered the moment it is paid for.
            Status = handedOver ? "delivered" : "completed",
            DeliveredAt = handedOver ? now : null,
            UserId = null,
            GuestEmail = Blank(customer?.Email),
            BuyerName = Blank(customer?.Name) ?? Blank(shippingAddress.FullName),
            BuyerPhone = Blank(customer?.Phone),
            AdminNotes = Blank(note),
            NeedsDetails = true,
            CreatedByAdminId = Blank(adminUserId)
        };

        await _mongoDbService.CreateOrderAsync(order);
        _logger.LogInformation(
            "Created in-person order {OrderId} for session {SessionId} ({Amount}, {Fulfillment})",
            order.Id, session.Id, charged, fulfillment);

        await ApplySoldSideEffectsAsync(listing, order);
        await NotifyAsync(listing, order, handedOver);

        return order;
    }

    /// <summary>
    /// Everything a sale does to the rest of the shop: the listing comes down, its finance
    /// transaction flips to sold, any locked cart item goes, open offers are rejected and
    /// their buyers told, and a hold on the guitar is flagged rather than silently ignored.
    /// </summary>
    private async Task ApplySoldSideEffectsAsync(MyListing listing, Order order)
    {
        var listingIds = new List<string> { listing.Id! };

        await _mongoDbService.DisableListingsByIdsAsync(listingIds);
        await _mongoDbService.MarkListingsSoldInTransactionsAsync(listingIds, order.CreatedAt);
        await _mongoDbService.DeletePendingCartItemByListingAsync(listing.Id!);

        // A walk-in buyer may or may not be the person the guitar was held for. We cannot
        // tell from here, so the hold is left for the admin to resolve, with the reason.
        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listing.Id!);
        if (reservation != null && reservation.IsActive && reservation.Id != null)
        {
            await _mongoDbService.FlagReservationForReviewAsync(
                reservation.Id,
                $"Sold in person (order {order.Id}) while this hold was active. " +
                "Confirm the walk-in buyer was the holder, or release the hold.");
            _logger.LogWarning(
                "In-person order {OrderId} sold reserved listing {ListingId}; reservation {ReservationId} flagged",
                order.Id, listing.Id, reservation.Id);
        }

        var rejectedOffers = await _mongoDbService.RejectAllOffersOnListingsAsync(listingIds);
        foreach (var rejectedOffer in rejectedOffers)
        {
            var buyer = await _mongoDbService.GetUserByIdAsync(rejectedOffer.BuyerId);
            if (buyer?.Email != null)
            {
                _ = _emailService.SendOfferRejectedNotificationAsync(
                    buyer.Email,
                    listing.ListingTitle,
                    rejectedOffer.CurrentOfferAmount,
                    "This item was purchased by another buyer.");
            }
        }

        var rejectedConversations = await _mongoDbService.RejectAllConversationOffersOnListingsAsync(listingIds);
        foreach (var conversation in rejectedConversations)
        {
            if (conversation.ActiveOfferBy == null || !conversation.ActiveOfferAmount.HasValue) continue;

            var buyer = await _mongoDbService.GetUserByIdAsync(conversation.ActiveOfferBy);
            if (buyer?.Email != null)
            {
                _ = _emailService.SendOfferRejectedNotificationAsync(
                    buyer.Email,
                    listing.ListingTitle,
                    conversation.ActiveOfferAmount.Value,
                    "This item was purchased by another buyer.");
            }
        }

        if (rejectedOffers.Count + rejectedConversations.Count > 0)
        {
            _logger.LogInformation(
                "In-person order {OrderId}: auto-rejected {Offers} offers and {Conversations} conversation offers",
                order.Id, rejectedOffers.Count, rejectedConversations.Count);
        }
    }

    private async Task NotifyAsync(MyListing listing, Order order, bool handedOver)
    {
        var items = order.Items.Select(i => (i.ListingTitle, i.Price, i.Currency)).ToList();
        var address = order.ShippingAddress;
        var addressFormatted = handedOver
            ? "Handed over in person"
            : $"{address.Line1}\n{(string.IsNullOrEmpty(address.Line2) ? "" : address.Line2 + "\n")}{address.City}, {address.State} {address.PostalCode}\n{address.Country}";

        if (!string.IsNullOrEmpty(order.GuestEmail))
        {
            _ = _emailService.SendInPersonReceiptToBuyerAsync(
                order.GuestEmail,
                order.Id!,
                items,
                order.TotalAmount,
                handedOver,
                order.BuyerName ?? "",
                addressFormatted);
        }

        _ = _emailService.SendNewOrderNotificationToSellerAsync(
            order.Id!,
            items,
            order.TotalAmount,
            order.BuyerName ?? "Walk-in buyer",
            addressFormatted,
            "In person (Stripe)");

        await Task.CompletedTask;
    }

    /// <summary>
    /// The address to ship to, when there is one. Stripe puts a collected shipping address
    /// under collected_information (newer API versions) or shipping_details (older); the
    /// billing address is the last resort. A handed-over sale records nothing.
    /// </summary>
    private static OrderShippingAddress ReadShippingAddress(
        Session session, SessionCustomerDetails? customer, bool handedOver)
    {
        var result = new OrderShippingAddress();
        if (handedOver) return result;

        var collected = session.CollectedInformation?.ShippingDetails;
        var legacy = session.ShippingDetails;

        var name = Blank(collected?.Name) ?? Blank(legacy?.Name) ?? Blank(customer?.Name) ?? "";
        var address = collected?.Address ?? legacy?.Address ?? customer?.Address;

        result.FullName = name;
        if (address != null)
        {
            result.Line1 = address.Line1 ?? "";
            result.Line2 = address.Line2;
            result.City = address.City ?? "";
            result.State = address.State ?? "";
            result.PostalCode = address.PostalCode ?? "";
            result.Country = address.Country ?? "";
        }

        return result;
    }

    private static string? Blank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value.Substring(0, max);
}
