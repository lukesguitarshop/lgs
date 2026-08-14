using GuitarDb.API.DTOs;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;
using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/checkout")]
public class CheckoutController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<CheckoutController> _logger;
    private readonly EmailService _emailService;
    private readonly ReservationService _reservationService;
    private readonly DepositService _depositService;

    public CheckoutController(
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<CheckoutController> logger,
        EmailService emailService,
        ReservationService reservationService,
        DepositService depositService)
    {
        _mongoDbService = mongoDbService;
        _configuration = configuration;
        _logger = logger;
        _emailService = emailService;
        _reservationService = reservationService;
        _depositService = depositService;
    }

    /// <summary>
    /// Reservation gate. Called at ALL THREE enforcement points — cart/session creation,
    /// payment-order creation, and again immediately before the order is written at
    /// capture. Re-checking at capture is what stops a stale session or a copied cart
    /// from buying a guitar that is promised to someone else.
    ///
    /// Returns null when the purchase may proceed, or the IActionResult to return.
    /// </summary>
    private async Task<IActionResult?> EnforceReservationsAsync(List<string> listingIds, string? userId)
    {
        var eligibility = await _reservationService.CheckPurchaseEligibilityAsync(listingIds, userId);
        if (eligibility.Allowed) return null;

        _logger.LogWarning(
            "Blocked checkout for user {UserId}: {Reason}",
            userId ?? "(anonymous)", eligibility.Reason);

        // 403 for "not yours"; the message never identifies the holder.
        return new ObjectResult(new
        {
            error = eligibility.Message ?? ReservationService.GenericHoldMessage,
            reason = eligibility.Reason.ToString()
        })
        {
            StatusCode = StatusCodes.Status403Forbidden
        };
    }

    /// <summary>
    /// Resolves what each listing costs this user, using the reservation's locked terms
    /// when they hold it. Never trusts a price from the browser.
    /// </summary>
    private async Task<Dictionary<string, decimal>> ResolveChargeAmountsAsync(
        List<MyListing> listings, string? userId)
    {
        var reservations = await _mongoDbService.GetActiveReservationsByListingIdsAsync(
            listings.Select(l => l.Id!));

        var result = new Dictionary<string, decimal>();
        foreach (var listing in listings)
        {
            reservations.TryGetValue(listing.Id!, out var reservation);
            result[listing.Id!] = ReservationService.ResolveChargeAmount(listing, reservation, userId);
        }

        return result;
    }

    /// <summary>
    /// Gathers the deposit already paid on these listings by this user, plus the ids
    /// needed to tie the final order back to the deposit order and the reservation.
    /// </summary>
    private async Task<(decimal DepositApplied, List<string>? DepositOrderIds, List<string>? ReservationIds)>
        CollectReservationOrderLinksAsync(List<string> listingIds, string? userId)
    {
        if (userId == null) return (0m, null, null);

        decimal depositApplied = 0m;
        var depositOrderIds = new List<string>();
        var reservationIds = new List<string>();

        foreach (var listingId in listingIds)
        {
            var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listingId);
            if (reservation == null || reservation.UserId != userId) continue;

            reservationIds.Add(reservation.Id!);
            depositApplied += reservation.DepositPaidAmount;

            if (!string.IsNullOrEmpty(reservation.DepositOrderId))
            {
                depositOrderIds.Add(reservation.DepositOrderId);
            }
        }

        return (
            depositApplied,
            depositOrderIds.Count > 0 ? depositOrderIds : null,
            reservationIds.Count > 0 ? reservationIds : null);
    }

    /// <summary>
    /// Marks reservations completed after a successful full purchase and links the order,
    /// so the deposit order and the balance order are tied together.
    /// </summary>
    private async Task CompleteReservationsForOrderAsync(List<string> listingIds, string? userId, string? orderId)
    {
        if (userId == null) return;

        foreach (var listingId in listingIds)
        {
            var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listingId);
            if (reservation == null || reservation.UserId != userId) continue;

            await _reservationService.CompleteReservationAsync(reservation, orderId);
        }
    }

    [HttpPost]
    public async Task<IActionResult> CreateCheckoutSession([FromBody] CheckoutRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { error = "Cart is empty" });
        }

        if (request.ShippingAddress == null)
        {
            return BadRequest(new { error = "Shipping address is required" });
        }

        var shipping = request.ShippingAddress;
        if (string.IsNullOrWhiteSpace(shipping.FullName) ||
            string.IsNullOrWhiteSpace(shipping.Line1) ||
            string.IsNullOrWhiteSpace(shipping.City) ||
            string.IsNullOrWhiteSpace(shipping.State) ||
            string.IsNullOrWhiteSpace(shipping.PostalCode) ||
            string.IsNullOrWhiteSpace(shipping.Country))
        {
            return BadRequest(new { error = "Please fill in all required shipping fields" });
        }

        var listingIds = request.Items.Select(i => i.ListingId).Distinct().ToList();
        var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);

        if (listings.Count == 0)
        {
            return BadRequest(new { error = "No valid listings found" });
        }

        var listingMap = listings.ToDictionary(l => l.Id!, l => l);

        var userId = GetUserIdIfAuthenticated();

        // Enforcement point 2 of 3: refuse to even create a payment session for a
        // guitar reserved for somebody else.
        var blocked = await EnforceReservationsAsync(listingIds, userId);
        if (blocked != null) return blocked;

        // Server-side pricing. Reserved items are charged their balance due
        // (agreed price - deposit paid - trade-in credit).
        var chargeAmounts = await ResolveChargeAmountsAsync(listings, userId);

        var lineItems = new List<SessionLineItemOptions>();
        var processedListingIds = new HashSet<string>();
        foreach (var item in request.Items)
        {
            // Skip duplicate listing IDs
            if (!processedListingIds.Add(item.ListingId))
            {
                continue;
            }

            if (!listingMap.TryGetValue(item.ListingId, out var listing))
            {
                _logger.LogWarning("Listing not found: {ListingId}", item.ListingId);
                continue;
            }

            var itemPrice = chargeAmounts.GetValueOrDefault(item.ListingId, listing.Price);

            lineItems.Add(new SessionLineItemOptions
            {
                PriceData = new SessionLineItemPriceDataOptions
                {
                    Currency = listing.Currency.ToLower(),
                    UnitAmount = (long)(itemPrice * 100),
                    ProductData = new SessionLineItemPriceDataProductDataOptions
                    {
                        Name = listing.ListingTitle,
                        Description = listing.Condition,
                        Images = listing.Images.Take(1).ToList()
                    }
                },
                Quantity = item.Quantity
            });
        }

        if (lineItems.Count == 0)
        {
            return BadRequest(new { error = "No valid items to checkout" });
        }

        // Apply store credit if requested
        decimal storeCreditApplied = 0;
        string? storeCreditId = null;
        if (request.ApplyStoreCredit && userId != null)
        {
            var sc = await _mongoDbService.GetStoreCreditByUserAsync(userId);
            if (sc != null && sc.Balance > 0)
            {
                var subtotal = lineItems.Sum(li => (li.PriceData?.UnitAmount ?? 0) * (li.Quantity ?? 1)) / 100m;
                storeCreditApplied = Math.Min(sc.Balance, subtotal);
                storeCreditId = sc.Id;
            }
        }

        if (storeCreditApplied > 0 && lineItems.Count > 0)
        {
            var creditCents = (long)(storeCreditApplied * 100);
            var first = lineItems[0];
            var newAmount = (first.PriceData!.UnitAmount ?? 0) - creditCents;
            if (newAmount < 0) newAmount = 0;
            first.PriceData.UnitAmount = newAmount;
            // Reflect the discount in the product name so the user sees it on Stripe's checkout
            first.PriceData.ProductData.Description =
                $"{first.PriceData.ProductData.Description} (store credit -${storeCreditApplied:N2})";
        }

        StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];

        var options = new SessionCreateOptions
        {
            PaymentMethodTypes = new List<string> { "card" },
            LineItems = lineItems,
            Mode = "payment",
            SuccessUrl = (_configuration["Stripe:SuccessUrl"] ?? "http://localhost:3000/checkout/success") + "?session_id={CHECKOUT_SESSION_ID}",
            CancelUrl = _configuration["Stripe:CancelUrl"] ?? "http://localhost:3000/checkout/cancel",
            ShippingOptions = new List<SessionShippingOptionOptions>
            {
                new SessionShippingOptionOptions
                {
                    ShippingRateData = new SessionShippingOptionShippingRateDataOptions
                    {
                        Type = "fixed_amount",
                        FixedAmount = new SessionShippingOptionShippingRateDataFixedAmountOptions
                        {
                            Amount = 0,
                            Currency = lineItems.First().PriceData.Currency
                        },
                        DisplayName = "Free Shipping"
                    }
                }
            },
            PaymentIntentData = new SessionPaymentIntentDataOptions
            {
                Metadata = new Dictionary<string, string>
                {
                    { "shipping_name", shipping.FullName },
                    { "shipping_line1", shipping.Line1 },
                    { "shipping_line2", shipping.Line2 ?? "" },
                    { "shipping_city", shipping.City },
                    { "shipping_state", shipping.State },
                    { "shipping_postal_code", shipping.PostalCode },
                    { "shipping_country", shipping.Country }
                }
            },
            Metadata = new Dictionary<string, string>
            {
                { "listing_ids", string.Join(",", listingIds) },
                { "user_id", userId ?? "" },
                { "store_credit_applied", storeCreditApplied.ToString("F2") },
                { "store_credit_id", storeCreditId ?? "" }
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        _logger.LogInformation("Created Stripe checkout session: {SessionId}", session.Id);

        return Ok(new CheckoutResponse
        {
            SessionUrl = session.Url,
            SessionId = session.Id
        });
    }

    [HttpPost("complete")]
    public async Task<IActionResult> CompleteCheckout([FromBody] CompleteCheckoutRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId))
        {
            return BadRequest(new { error = "Session ID is required" });
        }

        try
        {
            var existingOrder = await _mongoDbService.GetOrderBySessionIdAsync(request.SessionId);
            if (existingOrder != null)
            {
                _logger.LogInformation("Order already exists for session: {SessionId}", request.SessionId);
                return Ok(new { success = true, message = "Order already processed", orderId = existingOrder.Id });
            }

            StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];

            var sessionService = new SessionService();
            var session = await sessionService.GetAsync(request.SessionId, new SessionGetOptions
            {
                Expand = new List<string> { "payment_intent", "customer_details" }
            });

            if (session.PaymentStatus != "paid")
            {
                return BadRequest(new { error = "Payment not completed" });
            }

            if (!session.Metadata.TryGetValue("listing_ids", out var listingIdsString))
            {
                return BadRequest(new { error = "Invalid session data" });
            }

            var listingIds = listingIdsString.Split(',', StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();
            if (listingIds.Count == 0)
            {
                return BadRequest(new { error = "No items found in session" });
            }

            var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);
            var listingMap = listings.ToDictionary(l => l.Id!, l => l);

            // Get user_id from session metadata (stored during checkout creation)
            // This is more reliable than JWT since token may not be present after Stripe redirect
            session.Metadata.TryGetValue("user_id", out var userId);
            if (string.IsNullOrEmpty(userId)) userId = null;

            // Enforcement point 3 of 3: re-validate immediately before the order is written.
            // A session created minutes ago may now be for a guitar that got reserved,
            // or the hold may have expired in the meantime.
            var blockedAtCapture = await EnforceReservationsAsync(listingIds, userId);
            if (blockedAtCapture != null) return blockedAtCapture;

            // Recompute prices server-side rather than trusting the session.
            var chargeAmounts = await ResolveChargeAmountsAsync(listings, userId);

            var paymentIntent = session.PaymentIntent;
            var shippingAddress = new OrderShippingAddress();

            if (paymentIntent?.Metadata != null)
            {
                shippingAddress.FullName = paymentIntent.Metadata.GetValueOrDefault("shipping_name", "");
                shippingAddress.Line1 = paymentIntent.Metadata.GetValueOrDefault("shipping_line1", "");
                shippingAddress.Line2 = paymentIntent.Metadata.GetValueOrDefault("shipping_line2", "");
                shippingAddress.City = paymentIntent.Metadata.GetValueOrDefault("shipping_city", "");
                shippingAddress.State = paymentIntent.Metadata.GetValueOrDefault("shipping_state", "");
                shippingAddress.PostalCode = paymentIntent.Metadata.GetValueOrDefault("shipping_postal_code", "");
                shippingAddress.Country = paymentIntent.Metadata.GetValueOrDefault("shipping_country", "");
            }

            var orderItems = new List<OrderItem>();
            decimal totalAmount = 0;
            string currency = "USD";

            foreach (var listingId in listingIds)
            {
                if (listingMap.TryGetValue(listingId, out var listing))
                {
                    var itemPrice = chargeAmounts.GetValueOrDefault(listingId, listing.Price);

                    orderItems.Add(new OrderItem
                    {
                        ListingId = listing.Id!,
                        ListingTitle = listing.ListingTitle,
                        Price = itemPrice,
                        Currency = listing.Currency,
                        Quantity = 1
                    });
                    totalAmount += itemPrice;
                    currency = listing.Currency;
                }
            }

            // Link any deposit already paid on these listings so the paper trail is complete.
            var (depositApplied, depositOrderIds, reservationIds) =
                await CollectReservationOrderLinksAsync(listingIds, userId);

            var order = new Order
            {
                StripeSessionId = session.Id,
                StripePaymentIntentId = paymentIntent?.Id,
                Items = orderItems,
                ShippingAddress = shippingAddress,
                TotalAmount = totalAmount,
                Currency = currency,
                Status = "completed",
                UserId = userId,
                DepositApplied = depositApplied,
                DepositOrderIds = depositOrderIds,
                ReservationIds = reservationIds
            };

            // Apply store credit debit if metadata indicates credit was used
            session.Metadata.TryGetValue("store_credit_applied", out var creditAppliedStr);
            session.Metadata.TryGetValue("store_credit_id", out var creditIdStr);
            decimal.TryParse(creditAppliedStr, out var creditApplied);
            order.StoreCreditApplied = creditApplied;
            order.StoreCreditId = string.IsNullOrEmpty(creditIdStr) ? null : creditIdStr;

            if (creditApplied > 0 && userId != null)
            {
                var ok = await _mongoDbService.DebitUserStoreCreditAsync(
                    userId, creditApplied, $"order {order.StripeSessionId}", null);
                if (!ok)
                {
                    _logger.LogWarning("Store credit debit failed for user {User} amount {Amount}", userId, creditApplied);
                    // Continue anyway — order should still go through; we'll reconcile manually.
                }
            }

            await _mongoDbService.CreateOrderAsync(order);
            _logger.LogInformation("Created order {OrderId} for session {SessionId}", order.Id, session.Id);

            if (userId != null)
            {
                await _mongoDbService.LogActivityAsync(userId, "order_placed",
                    $"Placed an order — ${order.TotalAmount:N2} ({order.Items.Count} item{(order.Items.Count == 1 ? "" : "s")}, card)");
            }

            await _mongoDbService.DisableListingsByIdsAsync(listingIds);
            await _mongoDbService.MarkListingsSoldInTransactionsAsync(listingIds, DateTime.UtcNow);
            _logger.LogInformation("Disabled {Count} listings after successful checkout", listingIds.Count);

            // Reservation fulfilled: status -> Completed, linked to this order.
            await CompleteReservationsForOrderAsync(listingIds, userId, order.Id);

            // Remove pending cart items for purchased listings (from accepted offers)
            foreach (var item in order.Items)
            {
                await _mongoDbService.DeletePendingCartItemByListingAsync(item.ListingId);
            }
            _logger.LogInformation("Cleaned up pending cart items for {Count} listings", order.Items.Count);

            // Auto-reject all active offers on the purchased listings (legacy offers collection)
            var rejectedOffers = await _mongoDbService.RejectAllOffersOnListingsAsync(listingIds);
            if (rejectedOffers.Count > 0)
            {
                _logger.LogInformation("Auto-rejected {Count} offers due to checkout purchase", rejectedOffers.Count);

                // Send rejection emails to all affected buyers
                foreach (var rejectedOffer in rejectedOffers)
                {
                    var buyer = await _mongoDbService.GetUserByIdAsync(rejectedOffer.BuyerId);
                    var listing = listingMap.GetValueOrDefault(rejectedOffer.ListingId);
                    if (buyer?.Email != null && listing != null)
                    {
                        _ = _emailService.SendOfferRejectedNotificationAsync(
                            buyer.Email,
                            listing.ListingTitle,
                            rejectedOffer.CurrentOfferAmount,
                            "This item was purchased by another buyer.");
                    }
                }
            }

            // Auto-reject all active conversation-based offers on the purchased listings
            var rejectedConversations = await _mongoDbService.RejectAllConversationOffersOnListingsAsync(listingIds);
            if (rejectedConversations.Count > 0)
            {
                _logger.LogInformation("Auto-rejected {Count} conversation offers due to checkout purchase", rejectedConversations.Count);

                // Send rejection emails to all affected buyers
                foreach (var conversation in rejectedConversations)
                {
                    if (conversation.ActiveOfferBy != null && conversation.ListingId != null)
                    {
                        var buyer = await _mongoDbService.GetUserByIdAsync(conversation.ActiveOfferBy);
                        var listing = listingMap.GetValueOrDefault(conversation.ListingId);
                        if (buyer?.Email != null && listing != null && conversation.ActiveOfferAmount.HasValue)
                        {
                            _ = _emailService.SendOfferRejectedNotificationAsync(
                                buyer.Email,
                                listing.ListingTitle,
                                conversation.ActiveOfferAmount.Value,
                                "This item was purchased by another buyer.");
                        }
                    }
                }
            }

            // Send order confirmation emails
            var orderUser = userId != null ? await _mongoDbService.GetUserByIdAsync(userId) : null;
            var itemsForEmail = orderItems.Select(i => (i.ListingTitle, i.Price, i.Currency)).ToList();
            var shippingAddressFormatted = $"{shippingAddress.Line1}\n{(string.IsNullOrEmpty(shippingAddress.Line2) ? "" : shippingAddress.Line2 + "\n")}{shippingAddress.City}, {shippingAddress.State} {shippingAddress.PostalCode}\n{shippingAddress.Country}";

            // Send confirmation to buyer
            if (orderUser?.Email != null)
            {
                _ = _emailService.SendOrderConfirmationToBuyerAsync(
                    orderUser.Email,
                    order.Id!,
                    itemsForEmail,
                    totalAmount,
                    shippingAddress.FullName,
                    shippingAddressFormatted);
            }

            // Send notification to seller
            _ = _emailService.SendNewOrderNotificationToSellerAsync(
                order.Id!,
                itemsForEmail,
                totalAmount,
                shippingAddress.FullName,
                shippingAddressFormatted,
                "Stripe");

            return Ok(new { success = true, message = "Checkout completed successfully", orderId = order.Id });
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe error while completing checkout");
            return BadRequest(new { error = "Failed to verify payment" });
        }
    }

    [HttpPost("paypal/create")]
    public async Task<IActionResult> CreatePayPalOrder([FromBody] CheckoutRequest request)
    {
        if (request.Items == null || request.Items.Count == 0)
        {
            return BadRequest(new { error = "Cart is empty" });
        }

        if (request.ShippingAddress == null)
        {
            return BadRequest(new { error = "Shipping address is required" });
        }

        var shipping = request.ShippingAddress;
        if (string.IsNullOrWhiteSpace(shipping.FullName) ||
            string.IsNullOrWhiteSpace(shipping.Line1) ||
            string.IsNullOrWhiteSpace(shipping.City) ||
            string.IsNullOrWhiteSpace(shipping.State) ||
            string.IsNullOrWhiteSpace(shipping.PostalCode) ||
            string.IsNullOrWhiteSpace(shipping.Country))
        {
            return BadRequest(new { error = "Please fill in all required shipping fields" });
        }

        var listingIds = request.Items.Select(i => i.ListingId).Distinct().ToList();
        var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);

        if (listings.Count == 0)
        {
            return BadRequest(new { error = "No valid listings found" });
        }

        var listingMap = listings.ToDictionary(l => l.Id!, l => l);

        var userId = GetUserIdIfAuthenticated();

        // Enforcement point 2 of 3, PayPal path.
        var blocked = await EnforceReservationsAsync(listingIds, userId);
        if (blocked != null) return blocked;

        var chargeAmounts = await ResolveChargeAmountsAsync(listings, userId);

        decimal totalAmount = 0;
        string currency = "USD";
        var items = new List<object>();
        var processedListingIds = new HashSet<string>();

        foreach (var item in request.Items)
        {
            // Skip duplicate listing IDs
            if (!processedListingIds.Add(item.ListingId))
            {
                continue;
            }

            if (!listingMap.TryGetValue(item.ListingId, out var listing))
            {
                _logger.LogWarning("Listing not found: {ListingId}", item.ListingId);
                continue;
            }

            var itemPrice = chargeAmounts.GetValueOrDefault(item.ListingId, listing.Price);

            totalAmount += itemPrice * item.Quantity;
            currency = listing.Currency.ToUpper();

            items.Add(new
            {
                name = listing.ListingTitle.Length > 127 ? listing.ListingTitle.Substring(0, 127) : listing.ListingTitle,
                quantity = item.Quantity.ToString(),
                unit_amount = new
                {
                    currency_code = listing.Currency.ToUpper(),
                    value = itemPrice.ToString("F2")
                }
            });
        }

        if (items.Count == 0)
        {
            return BadRequest(new { error = "No valid items to checkout" });
        }

        // Apply store credit if requested (before fee so fee is calculated on reduced amount)
        decimal storeCreditApplied = 0m;
        if (request.ApplyStoreCredit && userId != null)
        {
            var sc = await _mongoDbService.GetStoreCreditByUserAsync(userId);
            if (sc != null && sc.Balance > 0)
            {
                storeCreditApplied = Math.Min(sc.Balance, totalAmount);
                storeCreditApplied = Math.Round(storeCreditApplied, 2);
            }
        }

        // Calculate 3.5% PayPal fee on amount after store credit
        var amountAfterCredit = totalAmount - storeCreditApplied;
        var transactionFee = Math.Round(amountAfterCredit * 0.035m, 2);
        items.Add(new
        {
            name = "PayPal Fee (3.5%)",
            quantity = "1",
            unit_amount = new
            {
                currency_code = currency,
                value = transactionFee.ToString("F2")
            }
        });
        var grandTotal = amountAfterCredit + transactionFee;

        try
        {
            var accessToken = await GetPayPalAccessToken();

            var itemTotal = totalAmount + transactionFee;
            object breakdown = storeCreditApplied > 0
                ? (object)new
                {
                    item_total = new { currency_code = currency, value = itemTotal.ToString("F2") },
                    discount = new { currency_code = currency, value = storeCreditApplied.ToString("F2") }
                }
                : new
                {
                    item_total = new { currency_code = currency, value = itemTotal.ToString("F2") }
                };

            var orderPayload = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        amount = new
                        {
                            currency_code = currency,
                            value = grandTotal.ToString("F2"),
                            breakdown
                        },
                        items = items,
                        custom_id = $"{userId ?? ""}|{string.Join(",", listingIds)}|{storeCreditApplied.ToString("F2")}",
                        shipping = new
                        {
                            name = new { full_name = shipping.FullName },
                            address = new
                            {
                                address_line_1 = shipping.Line1,
                                address_line_2 = shipping.Line2 ?? "",
                                admin_area_2 = shipping.City,
                                admin_area_1 = shipping.State,
                                postal_code = shipping.PostalCode,
                                country_code = GetCountryCode(shipping.Country)
                            }
                        }
                    }
                }
            };

            using var client = new HttpClient();
            var paypalMode = _configuration["PayPal:Mode"] ?? "sandbox";
            var baseUrl = paypalMode == "live"
                ? "https://api-m.paypal.com"
                : "https://api-m.sandbox.paypal.com";

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var content = new StringContent(
                JsonSerializer.Serialize(orderPayload),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.PostAsync($"{baseUrl}/v2/checkout/orders", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("PayPal order creation failed: {Response}", responseBody);
                return BadRequest(new { error = "Failed to create PayPal order" });
            }

            var orderResponse = JsonSerializer.Deserialize<JsonElement>(responseBody);
            var orderId = orderResponse.GetProperty("id").GetString();

            _logger.LogInformation("Created PayPal order: {OrderId}", orderId);

            return Ok(new { orderId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating PayPal order");
            return BadRequest(new { error = "Failed to create PayPal order" });
        }
    }

    [HttpPost("paypal/capture")]
    public async Task<IActionResult> CapturePayPalOrder([FromBody] PayPalCaptureRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.OrderId))
        {
            return BadRequest(new { error = "Order ID is required" });
        }

        try
        {
            var existingOrder = await _mongoDbService.GetOrderByPayPalOrderIdAsync(request.OrderId);
            if (existingOrder != null)
            {
                _logger.LogInformation("Order already exists for PayPal order: {OrderId}", request.OrderId);
                return Ok(new { success = true, message = "Order already processed", orderId = existingOrder.Id });
            }

            var accessToken = await GetPayPalAccessToken();

            using var client = new HttpClient();
            var paypalMode = _configuration["PayPal:Mode"] ?? "sandbox";
            var baseUrl = paypalMode == "live"
                ? "https://api-m.paypal.com"
                : "https://api-m.sandbox.paypal.com";

            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var content = new StringContent("{}", Encoding.UTF8, "application/json");
            var response = await client.PostAsync($"{baseUrl}/v2/checkout/orders/{request.OrderId}/capture", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("PayPal capture failed: {Response}", responseBody);
                return BadRequest(new { error = "Failed to capture PayPal payment" });
            }

            var captureResponse = JsonSerializer.Deserialize<JsonElement>(responseBody);
            var status = captureResponse.GetProperty("status").GetString();

            if (status != "COMPLETED")
            {
                return BadRequest(new { error = "Payment not completed" });
            }

            var purchaseUnit = captureResponse.GetProperty("purchase_units")[0];
            var customId = purchaseUnit.GetProperty("payments")
                .GetProperty("captures")[0]
                .GetProperty("custom_id").GetString() ?? "";
            var captureId = purchaseUnit.GetProperty("payments")
                .GetProperty("captures")[0]
                .GetProperty("id").GetString();

            // Parse custom_id format: "userId|listingId1,listingId2|storeCreditApplied"
            string? userId = null;
            string listingIdsString = customId;
            decimal storeCreditApplied = 0m;
            var parts = customId.Split('|');
            if (parts.Length >= 1) { userId = string.IsNullOrEmpty(parts[0]) ? null : parts[0]; }
            if (parts.Length >= 2) { listingIdsString = parts[1]; }
            if (parts.Length >= 3) { decimal.TryParse(parts[2], out storeCreditApplied); }

            var listingIds = listingIdsString.Split(',', StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();
            if (listingIds.Count == 0)
            {
                return BadRequest(new { error = "No items found in order" });
            }

            var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);
            var listingMap = listings.ToDictionary(l => l.Id!, l => l);

            // Enforcement point 3 of 3, PayPal path: re-validate right before writing the order.
            var blockedAtCapture = await EnforceReservationsAsync(listingIds, userId);
            if (blockedAtCapture != null) return blockedAtCapture;

            var chargeAmounts = await ResolveChargeAmountsAsync(listings, userId);

            var shippingInfo = purchaseUnit.GetProperty("shipping");
            var shippingAddress = new OrderShippingAddress
            {
                FullName = shippingInfo.GetProperty("name").GetProperty("full_name").GetString() ?? "",
                Line1 = shippingInfo.GetProperty("address").GetProperty("address_line_1").GetString() ?? "",
                Line2 = shippingInfo.GetProperty("address").TryGetProperty("address_line_2", out var line2) ? line2.GetString() : "",
                City = shippingInfo.GetProperty("address").GetProperty("admin_area_2").GetString() ?? "",
                State = shippingInfo.GetProperty("address").GetProperty("admin_area_1").GetString() ?? "",
                PostalCode = shippingInfo.GetProperty("address").GetProperty("postal_code").GetString() ?? "",
                Country = shippingInfo.GetProperty("address").GetProperty("country_code").GetString() ?? ""
            };

            var orderItems = new List<OrderItem>();
            decimal totalAmount = 0;
            string currency = "USD";

            foreach (var listingId in listingIds)
            {
                if (listingMap.TryGetValue(listingId, out var listing))
                {
                    var itemPrice = chargeAmounts.GetValueOrDefault(listingId, listing.Price);

                    orderItems.Add(new OrderItem
                    {
                        ListingId = listing.Id!,
                        ListingTitle = listing.ListingTitle,
                        Price = itemPrice,
                        Currency = listing.Currency,
                        Quantity = 1
                    });
                    totalAmount += itemPrice;
                    currency = listing.Currency;
                }
            }

            // Add 3.5% PayPal fee
            var transactionFee = Math.Round(totalAmount * 0.035m, 2);
            var grandTotal = totalAmount + transactionFee;

            // Link any deposit already paid so the paper trail is complete.
            var (depositApplied, depositOrderIds, reservationIds) =
                await CollectReservationOrderLinksAsync(listingIds, userId);

            var order = new Order
            {
                PaymentMethod = "paypal",
                PayPalOrderId = request.OrderId,
                PayPalCaptureId = captureId,
                Items = orderItems,
                ShippingAddress = shippingAddress,
                TotalAmount = grandTotal,
                Currency = currency,
                Status = "completed",
                UserId = userId,
                StoreCreditApplied = storeCreditApplied,
                DepositApplied = depositApplied,
                DepositOrderIds = depositOrderIds,
                ReservationIds = reservationIds
            };

            if (storeCreditApplied > 0 && userId != null)
            {
                var ok = await _mongoDbService.DebitUserStoreCreditAsync(
                    userId, storeCreditApplied, $"order {request.OrderId}", null);
                if (!ok)
                    _logger.LogWarning("Store credit debit failed for user {User} amount {Amount}", userId, storeCreditApplied);
            }

            await _mongoDbService.CreateOrderAsync(order);
            _logger.LogInformation("Created order {OrderId} for PayPal order {PayPalOrderId}", order.Id, request.OrderId);

            if (userId != null)
            {
                await _mongoDbService.LogActivityAsync(userId, "order_placed",
                    $"Placed an order — ${order.TotalAmount:N2} ({order.Items.Count} item{(order.Items.Count == 1 ? "" : "s")}, PayPal)");
            }

            await _mongoDbService.DisableListingsByIdsAsync(listingIds);
            await _mongoDbService.MarkListingsSoldInTransactionsAsync(listingIds, DateTime.UtcNow);
            _logger.LogInformation("Disabled {Count} listings after successful PayPal checkout", listingIds.Count);

            // Reservation fulfilled: status -> Completed, linked to this order.
            await CompleteReservationsForOrderAsync(listingIds, userId, order.Id);

            // Remove pending cart items for purchased listings (from accepted offers)
            foreach (var item in order.Items)
            {
                await _mongoDbService.DeletePendingCartItemByListingAsync(item.ListingId);
            }
            _logger.LogInformation("Cleaned up pending cart items for {Count} listings", order.Items.Count);

            // Auto-reject all active offers on the purchased listings (legacy offers collection)
            var rejectedOffers = await _mongoDbService.RejectAllOffersOnListingsAsync(listingIds);
            if (rejectedOffers.Count > 0)
            {
                _logger.LogInformation("Auto-rejected {Count} offers due to PayPal checkout purchase", rejectedOffers.Count);

                // Send rejection emails to all affected buyers
                foreach (var rejectedOffer in rejectedOffers)
                {
                    var buyer = await _mongoDbService.GetUserByIdAsync(rejectedOffer.BuyerId);
                    var listing = listingMap.GetValueOrDefault(rejectedOffer.ListingId);
                    if (buyer?.Email != null && listing != null)
                    {
                        _ = _emailService.SendOfferRejectedNotificationAsync(
                            buyer.Email,
                            listing.ListingTitle,
                            rejectedOffer.CurrentOfferAmount,
                            "This item was purchased by another buyer.");
                    }
                }
            }

            // Auto-reject all active conversation-based offers on the purchased listings
            var rejectedConversations = await _mongoDbService.RejectAllConversationOffersOnListingsAsync(listingIds);
            if (rejectedConversations.Count > 0)
            {
                _logger.LogInformation("Auto-rejected {Count} conversation offers due to PayPal checkout purchase", rejectedConversations.Count);

                // Send rejection emails to all affected buyers
                foreach (var conversation in rejectedConversations)
                {
                    if (conversation.ActiveOfferBy != null && conversation.ListingId != null)
                    {
                        var buyer = await _mongoDbService.GetUserByIdAsync(conversation.ActiveOfferBy);
                        var listing = listingMap.GetValueOrDefault(conversation.ListingId);
                        if (buyer?.Email != null && listing != null && conversation.ActiveOfferAmount.HasValue)
                        {
                            _ = _emailService.SendOfferRejectedNotificationAsync(
                                buyer.Email,
                                listing.ListingTitle,
                                conversation.ActiveOfferAmount.Value,
                                "This item was purchased by another buyer.");
                        }
                    }
                }
            }

            // Send order confirmation emails
            var orderUser = userId != null ? await _mongoDbService.GetUserByIdAsync(userId) : null;
            var itemsForEmail = orderItems.Select(i => (i.ListingTitle, i.Price, i.Currency)).ToList();
            var shippingAddressFormatted = $"{shippingAddress.Line1}\n{(string.IsNullOrEmpty(shippingAddress.Line2) ? "" : shippingAddress.Line2 + "\n")}{shippingAddress.City}, {shippingAddress.State} {shippingAddress.PostalCode}\n{shippingAddress.Country}";

            // Send confirmation to buyer
            if (orderUser?.Email != null)
            {
                _ = _emailService.SendOrderConfirmationToBuyerAsync(
                    orderUser.Email,
                    order.Id!,
                    itemsForEmail,
                    totalAmount,
                    shippingAddress.FullName,
                    shippingAddressFormatted);
            }

            // Send notification to seller
            _ = _emailService.SendNewOrderNotificationToSellerAsync(
                order.Id!,
                itemsForEmail,
                totalAmount,
                shippingAddress.FullName,
                shippingAddressFormatted,
                "PayPal");

            return Ok(new { success = true, message = "Payment captured successfully", orderId = order.Id });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error capturing PayPal payment");
            return BadRequest(new { error = "Failed to capture payment" });
        }
    }

    private async Task<string> GetPayPalAccessToken()
    {
        var clientId = _configuration["PayPal:ClientId"];
        var clientSecret = _configuration["PayPal:ClientSecret"];
        var paypalMode = _configuration["PayPal:Mode"] ?? "sandbox";
        var baseUrl = paypalMode == "live"
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";

        using var client = new HttpClient();
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials")
        });

        var response = await client.PostAsync($"{baseUrl}/v1/oauth2/token", content);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Failed to get PayPal access token: {Response}", responseBody);
            throw new Exception("Failed to authenticate with PayPal");
        }

        var tokenResponse = JsonSerializer.Deserialize<JsonElement>(responseBody);
        return tokenResponse.GetProperty("access_token").GetString()!;
    }

    /// <summary>
    /// Gets the user ID from the JWT token if authenticated, otherwise null
    /// </summary>
    private string? GetUserIdIfAuthenticated()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    private static string GetCountryCode(string country)
    {
        var countryMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "United States", "US" },
            { "USA", "US" },
            { "Canada", "CA" },
            { "United Kingdom", "GB" },
            { "UK", "GB" },
            { "Australia", "AU" },
            { "Germany", "DE" },
            { "France", "FR" },
            { "Japan", "JP" },
            { "Mexico", "MX" }
        };

        if (countryMap.TryGetValue(country, out var code))
            return code;

        return country.Length == 2 ? country.ToUpper() : "US";
    }

    /// <summary>
    /// Stripe webhook endpoint - creates order if frontend call failed
    /// </summary>
    [HttpPost("webhook")]
    public async Task<IActionResult> StripeWebhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var webhookSecret = _configuration["Stripe:WebhookSecret"];

        // If no webhook secret configured, skip signature verification (for testing)
        Event stripeEvent;
        if (!string.IsNullOrEmpty(webhookSecret))
        {
            try
            {
                stripeEvent = EventUtility.ConstructEvent(
                    json,
                    Request.Headers["Stripe-Signature"],
                    webhookSecret
                );
            }
            catch (StripeException ex)
            {
                _logger.LogError(ex, "Stripe webhook signature verification failed");
                return BadRequest(new { error = "Webhook signature verification failed" });
            }
        }
        else
        {
            stripeEvent = EventUtility.ParseEvent(json);
            _logger.LogWarning("Stripe webhook secret not configured - skipping signature verification");
        }

        if (stripeEvent.Type == "checkout.session.completed")
        {
            var session = stripeEvent.Data.Object as Session;
            if (session == null)
            {
                _logger.LogWarning("Webhook: Could not parse session from event");
                return Ok();
            }

            _logger.LogInformation("Webhook: Processing checkout.session.completed for session {SessionId}", session.Id);

            // Check if order already exists (created by frontend)
            var existingOrder = await _mongoDbService.GetOrderBySessionIdAsync(session.Id);
            if (existingOrder != null)
            {
                _logger.LogInformation("Webhook: Order already exists for session {SessionId}, skipping", session.Id);
                return Ok();
            }

            // Need to expand session to get payment intent metadata
            StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];
            var sessionService = new SessionService();
            var expandedSession = await sessionService.GetAsync(session.Id, new SessionGetOptions
            {
                Expand = new List<string> { "payment_intent" }
            });

            if (expandedSession.PaymentStatus != "paid")
            {
                _logger.LogWarning("Webhook: Payment not completed for session {SessionId}", session.Id);
                return Ok();
            }

            if (!expandedSession.Metadata.TryGetValue("listing_ids", out var listingIdsString))
            {
                _logger.LogWarning("Webhook: No listing_ids in session metadata for {SessionId}", session.Id);
                return Ok();
            }

            var listingIds = listingIdsString.Split(',', StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();
            if (listingIds.Count == 0)
            {
                _logger.LogWarning("Webhook: Empty listing_ids for session {SessionId}", session.Id);
                return Ok();
            }

            var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);
            var listingMap = listings.ToDictionary(l => l.Id!, l => l);

            expandedSession.Metadata.TryGetValue("user_id", out var userId);
            if (string.IsNullOrEmpty(userId)) userId = null;

            // Deposit sessions are settled by the dedicated deposit handler, which knows
            // how to record the payment against the reservation.
            if (expandedSession.Metadata.TryGetValue("order_type", out var webhookOrderType)
                && webhookOrderType == OrderType.Deposit)
            {
                expandedSession.Metadata.TryGetValue("reservation_id", out var webhookReservationId);
                if (!string.IsNullOrEmpty(webhookReservationId))
                {
                    await _depositService.SettleStripeDepositSessionAsync(expandedSession, webhookReservationId);
                }
                return Ok();
            }

            // The money is already captured by the time a webhook arrives, so we never
            // refuse here — we record the order and flag any reservation conflict for review.
            if (userId != null)
            {
                var eligibility = await _reservationService.CheckPurchaseEligibilityAsync(listingIds, userId);
                if (!eligibility.Allowed && eligibility.Reservation?.Id != null)
                {
                    await _mongoDbService.FlagReservationForReviewAsync(
                        eligibility.Reservation.Id,
                        $"Payment captured via webhook for session {expandedSession.Id} by user {userId}, " +
                        $"but the reservation check said: {eligibility.Reason}. Verify who this guitar belongs to.");
                }
            }

            var chargeAmounts = await ResolveChargeAmountsAsync(listings, userId);

            var paymentIntent = expandedSession.PaymentIntent;
            var shippingAddress = new OrderShippingAddress();

            if (paymentIntent?.Metadata != null)
            {
                shippingAddress.FullName = paymentIntent.Metadata.GetValueOrDefault("shipping_name", "");
                shippingAddress.Line1 = paymentIntent.Metadata.GetValueOrDefault("shipping_line1", "");
                shippingAddress.Line2 = paymentIntent.Metadata.GetValueOrDefault("shipping_line2", "");
                shippingAddress.City = paymentIntent.Metadata.GetValueOrDefault("shipping_city", "");
                shippingAddress.State = paymentIntent.Metadata.GetValueOrDefault("shipping_state", "");
                shippingAddress.PostalCode = paymentIntent.Metadata.GetValueOrDefault("shipping_postal_code", "");
                shippingAddress.Country = paymentIntent.Metadata.GetValueOrDefault("shipping_country", "");
            }

            var orderItems = new List<OrderItem>();
            decimal totalAmount = 0;
            string currency = "USD";

            foreach (var listingId in listingIds)
            {
                if (listingMap.TryGetValue(listingId, out var listing))
                {
                    var itemPrice = chargeAmounts.GetValueOrDefault(listingId, listing.Price);

                    orderItems.Add(new OrderItem
                    {
                        ListingId = listing.Id!,
                        ListingTitle = listing.ListingTitle,
                        Price = itemPrice,
                        Currency = listing.Currency,
                        Quantity = 1
                    });
                    totalAmount += itemPrice;
                    currency = listing.Currency;
                }
            }

            var (webhookDepositApplied, webhookDepositOrderIds, webhookReservationIds) =
                await CollectReservationOrderLinksAsync(listingIds, userId);

            var order = new Order
            {
                StripeSessionId = expandedSession.Id,
                StripePaymentIntentId = paymentIntent?.Id,
                Items = orderItems,
                ShippingAddress = shippingAddress,
                TotalAmount = totalAmount,
                Currency = currency,
                Status = "completed",
                UserId = userId,
                DepositApplied = webhookDepositApplied,
                DepositOrderIds = webhookDepositOrderIds,
                ReservationIds = webhookReservationIds
            };

            await _mongoDbService.CreateOrderAsync(order);
            _logger.LogInformation("Webhook: Created order {OrderId} for session {SessionId}", order.Id, session.Id);

            await _mongoDbService.DisableListingsByIdsAsync(listingIds);
            await _mongoDbService.MarkListingsSoldInTransactionsAsync(listingIds, DateTime.UtcNow);
            _logger.LogInformation("Webhook: Disabled {Count} listings", listingIds.Count);

            await CompleteReservationsForOrderAsync(listingIds, userId, order.Id);

            // Remove pending cart items
            foreach (var item in order.Items)
            {
                await _mongoDbService.DeletePendingCartItemByListingAsync(item.ListingId);
            }

            // Auto-reject all active offers on the purchased listings (legacy offers collection)
            var rejectedOffers = await _mongoDbService.RejectAllOffersOnListingsAsync(listingIds);
            if (rejectedOffers.Count > 0)
            {
                _logger.LogInformation("Webhook: Auto-rejected {Count} offers", rejectedOffers.Count);

                foreach (var rejectedOffer in rejectedOffers)
                {
                    var buyer = await _mongoDbService.GetUserByIdAsync(rejectedOffer.BuyerId);
                    var listing = listingMap.GetValueOrDefault(rejectedOffer.ListingId);
                    if (buyer?.Email != null && listing != null)
                    {
                        _ = _emailService.SendOfferRejectedNotificationAsync(
                            buyer.Email,
                            listing.ListingTitle,
                            rejectedOffer.CurrentOfferAmount,
                            "This item was purchased by another buyer.");
                    }
                }
            }

            // Auto-reject all active conversation-based offers on the purchased listings
            var rejectedConversations = await _mongoDbService.RejectAllConversationOffersOnListingsAsync(listingIds);
            if (rejectedConversations.Count > 0)
            {
                _logger.LogInformation("Webhook: Auto-rejected {Count} conversation offers", rejectedConversations.Count);

                foreach (var conversation in rejectedConversations)
                {
                    if (conversation.ActiveOfferBy != null && conversation.ListingId != null)
                    {
                        var buyer = await _mongoDbService.GetUserByIdAsync(conversation.ActiveOfferBy);
                        var listing = listingMap.GetValueOrDefault(conversation.ListingId);
                        if (buyer?.Email != null && listing != null && conversation.ActiveOfferAmount.HasValue)
                        {
                            _ = _emailService.SendOfferRejectedNotificationAsync(
                                buyer.Email,
                                listing.ListingTitle,
                                conversation.ActiveOfferAmount.Value,
                                "This item was purchased by another buyer.");
                        }
                    }
                }
            }

            // Send order confirmation emails
            var orderUser = userId != null ? await _mongoDbService.GetUserByIdAsync(userId) : null;
            var itemsForEmail = orderItems.Select(i => (i.ListingTitle, i.Price, i.Currency)).ToList();
            var shippingAddressFormatted = $"{shippingAddress.Line1}\n{(string.IsNullOrEmpty(shippingAddress.Line2) ? "" : shippingAddress.Line2 + "\n")}{shippingAddress.City}, {shippingAddress.State} {shippingAddress.PostalCode}\n{shippingAddress.Country}";

            // Send confirmation to buyer
            if (orderUser?.Email != null)
            {
                _ = _emailService.SendOrderConfirmationToBuyerAsync(
                    orderUser.Email,
                    order.Id!,
                    itemsForEmail,
                    totalAmount,
                    shippingAddress.FullName,
                    shippingAddressFormatted);
            }

            // Send notification to seller
            _ = _emailService.SendNewOrderNotificationToSellerAsync(
                order.Id!,
                itemsForEmail,
                totalAmount,
                shippingAddress.FullName,
                shippingAddressFormatted,
                "Stripe");
        }

        return Ok();
    }
}
