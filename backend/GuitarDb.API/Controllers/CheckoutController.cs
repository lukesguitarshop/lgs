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

    public CheckoutController(
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<CheckoutController> logger)
    {
        _mongoDbService = mongoDbService;
        _configuration = configuration;
        _logger = logger;
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

        // Fetch pending cart items to get accepted offer prices for the current user
        var userId = GetUserIdIfAuthenticated();
        var pendingCartItems = userId != null
            ? await _mongoDbService.GetPendingCartItemsByUserAndListingIdsAsync(userId, listingIds)
            : new List<PendingCartItem>();
        var pendingCartMap = pendingCartItems
            .GroupBy(p => p.ListingId)
            .ToDictionary(g => g.Key, g => g.First());

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

            // Use pending cart item price (from accepted offer) if available, otherwise use listing price
            var itemPrice = pendingCartMap.TryGetValue(item.ListingId, out var pendingItem)
                ? pendingItem.Price
                : listing.Price;

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
                { "user_id", userId ?? "" }
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

            // Fetch pending cart items to get accepted offer prices for the current user
            var pendingCartItems = userId != null
                ? await _mongoDbService.GetPendingCartItemsByUserAndListingIdsAsync(userId, listingIds)
                : new List<PendingCartItem>();
            var pendingCartMap = pendingCartItems
                .GroupBy(p => p.ListingId)
                .ToDictionary(g => g.Key, g => g.First());

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
                    // Use pending cart item price (from accepted offer) if available, otherwise use listing price
                    var itemPrice = pendingCartMap.TryGetValue(listingId, out var pendingItem)
                        ? pendingItem.Price
                        : listing.Price;

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

            var order = new Order
            {
                StripeSessionId = session.Id,
                StripePaymentIntentId = paymentIntent?.Id,
                Items = orderItems,
                ShippingAddress = shippingAddress,
                TotalAmount = totalAmount,
                Currency = currency,
                Status = "completed",
                UserId = userId
            };

            await _mongoDbService.CreateOrderAsync(order);
            _logger.LogInformation("Created order {OrderId} for session {SessionId}", order.Id, session.Id);

            await _mongoDbService.DisableListingsByIdsAsync(listingIds);
            _logger.LogInformation("Disabled {Count} listings after successful checkout", listingIds.Count);

            // Remove pending cart items for purchased listings (from accepted offers)
            foreach (var item in order.Items)
            {
                await _mongoDbService.DeletePendingCartItemByListingAsync(item.ListingId);
            }
            _logger.LogInformation("Cleaned up pending cart items for {Count} listings", order.Items.Count);

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

        // Fetch pending cart items to get accepted offer prices for the current user
        var userId = GetUserIdIfAuthenticated();
        var pendingCartItems = userId != null
            ? await _mongoDbService.GetPendingCartItemsByUserAndListingIdsAsync(userId, listingIds)
            : new List<PendingCartItem>();
        var pendingCartMap = pendingCartItems
            .GroupBy(p => p.ListingId)
            .ToDictionary(g => g.Key, g => g.First());

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

            // Use pending cart item price (from accepted offer) if available, otherwise use listing price
            var itemPrice = pendingCartMap.TryGetValue(item.ListingId, out var pendingItem)
                ? pendingItem.Price
                : listing.Price;

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

        try
        {
            var accessToken = await GetPayPalAccessToken();

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
                            value = totalAmount.ToString("F2"),
                            breakdown = new
                            {
                                item_total = new
                                {
                                    currency_code = currency,
                                    value = totalAmount.ToString("F2")
                                }
                            }
                        },
                        items = items,
                        custom_id = $"{userId ?? ""}|{string.Join(",", listingIds)}",
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

            // Parse custom_id format: "userId|listingId1,listingId2"
            string? userId = null;
            string listingIdsString = customId;
            var pipeIndex = customId.IndexOf('|');
            if (pipeIndex >= 0)
            {
                userId = customId.Substring(0, pipeIndex);
                if (string.IsNullOrEmpty(userId)) userId = null;
                listingIdsString = customId.Substring(pipeIndex + 1);
            }

            var listingIds = listingIdsString.Split(',', StringSplitOptions.RemoveEmptyEntries).Distinct().ToList();
            if (listingIds.Count == 0)
            {
                return BadRequest(new { error = "No items found in order" });
            }

            var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);
            var listingMap = listings.ToDictionary(l => l.Id!, l => l);

            // Fetch pending cart items to get accepted offer prices for the user who created the order
            var pendingCartItems = userId != null
                ? await _mongoDbService.GetPendingCartItemsByUserAndListingIdsAsync(userId, listingIds)
                : new List<PendingCartItem>();
            var pendingCartMap = pendingCartItems
                .GroupBy(p => p.ListingId)
                .ToDictionary(g => g.Key, g => g.First());

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
                    // Use pending cart item price (from accepted offer) if available, otherwise use listing price
                    var itemPrice = pendingCartMap.TryGetValue(listingId, out var pendingItem)
                        ? pendingItem.Price
                        : listing.Price;

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

            var order = new Order
            {
                PaymentMethod = "paypal",
                PayPalOrderId = request.OrderId,
                PayPalCaptureId = captureId,
                Items = orderItems,
                ShippingAddress = shippingAddress,
                TotalAmount = totalAmount,
                Currency = currency,
                Status = "completed",
                UserId = userId
            };

            await _mongoDbService.CreateOrderAsync(order);
            _logger.LogInformation("Created order {OrderId} for PayPal order {PayPalOrderId}", order.Id, request.OrderId);

            await _mongoDbService.DisableListingsByIdsAsync(listingIds);
            _logger.LogInformation("Disabled {Count} listings after successful PayPal checkout", listingIds.Count);

            // Remove pending cart items for purchased listings (from accepted offers)
            foreach (var item in order.Items)
            {
                await _mongoDbService.DeletePendingCartItemByListingAsync(item.ListingId);
            }
            _logger.LogInformation("Cleaned up pending cart items for {Count} listings", order.Items.Count);

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
}
