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

/// <summary>
/// Dedicated deposit checkout — deliberately separate from the normal cart flow.
///
/// A deposit session contains ONLY the deposit line item. No shipping is charged and no
/// shipping address is collected (nothing ships yet), and no tax is charged on the
/// deposit — tax, where applicable, belongs on the balance order.
///
/// The resulting order is tagged OrderType.Deposit and linked to the reservation so it
/// is distinguishable from a real sale in the Orders tab and in reporting.
/// </summary>
[ApiController]
[Route("api/checkout/deposit")]
public class DepositCheckoutController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly DepositService _depositService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<DepositCheckoutController> _logger;

    public DepositCheckoutController(
        MongoDbService mongoDbService,
        DepositService depositService,
        IConfiguration configuration,
        ILogger<DepositCheckoutController> logger)
    {
        _mongoDbService = mongoDbService;
        _depositService = depositService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Everything the deposit checkout page needs to render: guitar, deposit amount,
    /// balance after deposit, refundability, and expiry. Only the reserved user may read it.
    /// </summary>
    [HttpGet("{reservationId}")]
    public async Task<IActionResult> GetDepositDetails(string reservationId)
    {
        var (reservation, listing, error) = await LoadPayableReservationAsync(reservationId);
        if (error != null) return error;

        return Ok(new
        {
            reservation_id = reservation!.Id,
            listing_id = listing!.Id,
            listing_title = listing.ListingTitle,
            listing_image = listing.Images.FirstOrDefault(),
            currency = listing.Currency,
            line_item_label = $"Deposit — {listing.ListingTitle}",

            agreed_price = reservation.AgreedPrice,
            trade_in_credit = reservation.TradeInCredit,
            deposit_amount = reservation.DepositAmount,
            deposit_refundable = reservation.DepositRefundable,
            balance_after_deposit = Math.Max(
                0m, reservation.AgreedPrice - reservation.TradeInCredit - reservation.DepositAmount),
            expires_at = reservation.ExpiresAt,

            // Stated explicitly so the page can show it rather than implying it.
            shipping_charged = false,
            tax_charged = false
        });
    }

    /// <summary>Creates a Stripe Checkout session containing only the deposit.</summary>
    [HttpPost("{reservationId}/stripe")]
    public async Task<IActionResult> CreateStripeDepositSession(string reservationId)
    {
        var (reservation, listing, error) = await LoadPayableReservationAsync(reservationId);
        if (error != null) return error;

        StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];

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
                        Currency = listing!.Currency.ToLower(),
                        UnitAmount = (long)(reservation!.DepositAmount * 100),
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"Deposit — {listing.ListingTitle}",
                            Description = reservation.DepositRefundable
                                ? "Refundable deposit to secure this guitar"
                                : "Non-refundable deposit to secure this guitar",
                            Images = listing.Images.Take(1).ToList()
                        }
                    },
                    Quantity = 1
                }
            },
            // No ShippingOptions and no shipping address collection: nothing ships on a deposit.
            SuccessUrl = $"{FrontendUrl()}/deposit/{reservationId}/success?session_id={{CHECKOUT_SESSION_ID}}",
            CancelUrl = $"{FrontendUrl()}/deposit/{reservationId}?cancelled=1",
            Metadata = new Dictionary<string, string>
            {
                { "order_type", OrderType.Deposit },
                { "reservation_id", reservationId },
                { "listing_ids", reservation.ListingId },
                { "user_id", reservation.UserId ?? "" }
            }
        };

        var service = new SessionService();
        var session = await service.CreateAsync(options);

        _logger.LogInformation(
            "Created deposit checkout session {SessionId} for reservation {ReservationId} ({Amount:C})",
            session.Id, reservationId, reservation.DepositAmount);

        return Ok(new { sessionUrl = session.Url, sessionId = session.Id });
    }

    /// <summary>Settles a Stripe deposit session after the redirect back.</summary>
    [HttpPost("{reservationId}/stripe/complete")]
    public async Task<IActionResult> CompleteStripeDeposit(
        string reservationId, [FromBody] CompleteDepositRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId))
        {
            return BadRequest(new { error = "Session ID is required" });
        }

        StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];
        var sessionService = new SessionService();
        var session = await sessionService.GetAsync(request.SessionId, new SessionGetOptions
        {
            Expand = new List<string> { "payment_intent" }
        });

        if (session.PaymentStatus != "paid")
        {
            // Abandoned or failed: the reservation simply stays Pending and they can retry.
            return BadRequest(new { error = "Payment not completed" });
        }

        var order = await _depositService.SettleStripeDepositSessionAsync(session, reservationId);
        if (order == null)
        {
            return BadRequest(new { error = "Could not record this deposit. Please contact us." });
        }

        var reservation = await _mongoDbService.GetReservationByIdAsync(reservationId);

        return Ok(new
        {
            success = true,
            orderId = order.Id,
            deposit_paid = reservation?.DepositPaidAmount ?? 0m,
            balance_due = reservation?.BalanceDue ?? 0m
        });
    }

    /// <summary>Creates a PayPal order containing only the deposit.</summary>
    [HttpPost("{reservationId}/paypal/create")]
    public async Task<IActionResult> CreatePayPalDeposit(string reservationId)
    {
        var (reservation, listing, error) = await LoadPayableReservationAsync(reservationId);
        if (error != null) return error;

        var currency = listing!.Currency.ToUpper();
        var amount = reservation!.DepositAmount;

        try
        {
            var accessToken = await GetPayPalAccessToken();

            var payload = new
            {
                intent = "CAPTURE",
                purchase_units = new[]
                {
                    new
                    {
                        amount = new
                        {
                            currency_code = currency,
                            value = amount.ToString("F2"),
                            breakdown = new
                            {
                                item_total = new { currency_code = currency, value = amount.ToString("F2") }
                            }
                        },
                        items = new[]
                        {
                            new
                            {
                                name = Truncate($"Deposit — {listing.ListingTitle}", 127),
                                quantity = "1",
                                unit_amount = new { currency_code = currency, value = amount.ToString("F2") }
                            }
                        },
                        // No shipping block: deposits collect no address.
                        custom_id = $"deposit|{reservationId}|{reservation.UserId}"
                    }
                }
            };

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await client.PostAsync(
                $"{PayPalBaseUrl()}/v2/checkout/orders",
                new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json"));

            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("PayPal deposit order creation failed: {Response}", body);
                return BadRequest(new { error = "Failed to create PayPal order" });
            }

            var orderId = JsonSerializer.Deserialize<JsonElement>(body).GetProperty("id").GetString();
            return Ok(new { orderId });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating PayPal deposit order");
            return BadRequest(new { error = "Failed to create PayPal order" });
        }
    }

    /// <summary>Captures a PayPal deposit and records it against the reservation.</summary>
    [HttpPost("{reservationId}/paypal/capture")]
    public async Task<IActionResult> CapturePayPalDeposit(
        string reservationId, [FromBody] CaptureDepositRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.OrderId))
        {
            return BadRequest(new { error = "Order ID is required" });
        }

        // Idempotency: a double-click must not create a second deposit order.
        var existing = await _mongoDbService.GetOrderByPayPalOrderIdAsync(request.OrderId);
        if (existing != null)
        {
            return Ok(new { success = true, message = "Deposit already processed", orderId = existing.Id });
        }

        var (reservation, listing, error) = await LoadPayableReservationAsync(reservationId);
        if (error != null) return error;

        try
        {
            var accessToken = await GetPayPalAccessToken();

            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

            var response = await client.PostAsync(
                $"{PayPalBaseUrl()}/v2/checkout/orders/{request.OrderId}/capture",
                new StringContent("{}", Encoding.UTF8, "application/json"));

            var body = await response.Content.ReadAsStringAsync();
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("PayPal deposit capture failed: {Response}", body);
                return BadRequest(new { error = "Failed to capture PayPal payment" });
            }

            var captureResponse = JsonSerializer.Deserialize<JsonElement>(body);
            if (captureResponse.GetProperty("status").GetString() != "COMPLETED")
            {
                return BadRequest(new { error = "Payment not completed" });
            }

            var captureId = captureResponse.GetProperty("purchase_units")[0]
                .GetProperty("payments").GetProperty("captures")[0]
                .GetProperty("id").GetString();

            var order = await _depositService.CreateDepositOrderAsync(
                reservation!, listing!,
                paymentMethod: "paypal",
                stripeSessionId: null,
                stripePaymentIntentId: null,
                payPalOrderId: request.OrderId,
                payPalCaptureId: captureId);

            await _depositService.ApplyDepositAndNotifyAsync(reservation!, listing!, order, "paypal");

            var refreshed = await _mongoDbService.GetReservationByIdAsync(reservationId);

            return Ok(new
            {
                success = true,
                orderId = order.Id,
                deposit_paid = refreshed?.DepositPaidAmount ?? 0m,
                balance_due = refreshed?.BalanceDue ?? 0m
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error capturing PayPal deposit");
            return BadRequest(new { error = "Failed to capture PayPal payment" });
        }
    }

    // ---------------- shared internals ----------------

    /// <summary>
    /// Loads a reservation that the CALLER is allowed to pay a deposit on, with all the
    /// guards applied. Every deposit entry point goes through this.
    /// </summary>
    private async Task<(Reservation?, MyListing?, IActionResult?)> LoadPayableReservationAsync(string reservationId)
    {
        var userId = GetUserIdIfAuthenticated();
        if (userId == null)
        {
            return (null, null, Unauthorized(new { error = "Authentication required" }));
        }

        var reservation = await _mongoDbService.GetReservationByIdAsync(reservationId);
        if (reservation == null)
        {
            return (null, null, NotFound(new { error = "Reservation not found" }));
        }

        // Only the reserved user, and never leaking who that is.
        if (reservation.IsUnassigned || reservation.UserId != userId)
        {
            return (null, null, new ObjectResult(new { error = ReservationService.GenericHoldMessage })
            {
                StatusCode = StatusCodes.Status403Forbidden
            });
        }

        if (!reservation.IsActive)
        {
            return (null, null, BadRequest(new { error = "This hold is no longer active." }));
        }

        if (reservation.IsExpired)
        {
            return (null, null, BadRequest(new
            {
                error = "This hold has expired. Please contact us to reinstate it."
            }));
        }

        if (!reservation.DepositRequired || reservation.DepositAmount <= 0)
        {
            return (null, null, BadRequest(new { error = "No deposit is required on this hold." }));
        }

        if (reservation.Status == ReservationStatus.DepositPaid)
        {
            return (null, null, BadRequest(new { error = "The deposit on this hold has already been paid." }));
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(reservation.ListingId);
        if (listing == null)
        {
            return (null, null, NotFound(new { error = "Listing not found" }));
        }

        return (reservation, listing, null);
    }

    private async Task<string> GetPayPalAccessToken()
    {
        var clientId = _configuration["PayPal:ClientId"];
        var clientSecret = _configuration["PayPal:ClientSecret"];

        using var client = new HttpClient();
        var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{clientId}:{clientSecret}"));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", credentials);

        var content = new FormUrlEncodedContent(new[]
        {
            new KeyValuePair<string, string>("grant_type", "client_credentials")
        });

        var response = await client.PostAsync($"{PayPalBaseUrl()}/v1/oauth2/token", content);
        var body = await response.Content.ReadAsStringAsync();

        return JsonSerializer.Deserialize<JsonElement>(body).GetProperty("access_token").GetString()!;
    }

    private string PayPalBaseUrl() =>
        (_configuration["PayPal:Mode"] ?? "sandbox") == "live"
            ? "https://api-m.paypal.com"
            : "https://api-m.sandbox.paypal.com";

    private string FrontendUrl() =>
        _configuration["FrontendUrl"] ?? "http://localhost:3000";

    private static string Truncate(string value, int max) =>
        value.Length > max ? value.Substring(0, max) : value;

    private string? GetUserIdIfAuthenticated()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}

public class CompleteDepositRequest
{
    public string SessionId { get; set; } = string.Empty;
}

public class CaptureDepositRequest
{
    public string OrderId { get; set; } = string.Empty;
}
