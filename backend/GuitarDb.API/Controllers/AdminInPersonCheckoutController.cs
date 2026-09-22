using System.Security.Claims;
using System.Text.Json.Serialization;
using GuitarDb.API.Attributes;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;

namespace GuitarDb.API.Controllers;

/// <summary>
/// The admin's point-of-sale: start a Stripe Checkout for one guitar so a buyer standing
/// in the shop can pay by card without an account, then record the sale when they are done.
/// Everything here requires an admin token; the buyer never touches these endpoints.
/// </summary>
[ApiController]
[Route("api/admin/in-person-checkout")]
[AdminAuthorize]
public class AdminInPersonCheckoutController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly InPersonCheckoutService _inPersonCheckout;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AdminInPersonCheckoutController> _logger;

    public AdminInPersonCheckoutController(
        MongoDbService mongoDbService,
        InPersonCheckoutService inPersonCheckout,
        IConfiguration configuration,
        ILogger<AdminInPersonCheckoutController> logger)
    {
        _mongoDbService = mongoDbService;
        _inPersonCheckout = inPersonCheckout;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>
    /// Creates the Stripe session. The price defaults to the listing price and may be
    /// overridden with whatever was agreed on the shop floor. A guitar under an active
    /// hold needs the admin's explicit acknowledgement before it can be sold.
    /// </summary>
    [HttpPost("session")]
    public async Task<IActionResult> CreateSession([FromBody] CreateInPersonSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ListingId))
        {
            return BadRequest(new { error = "Pick a guitar first." });
        }

        var fulfillment = string.IsNullOrWhiteSpace(request.Fulfillment)
            ? OrderFulfillment.HandedOver
            : request.Fulfillment.Trim().ToLowerInvariant();
        if (!OrderFulfillment.IsValid(fulfillment))
        {
            return BadRequest(new { error = "Fulfillment must be 'handed_over' or 'ship'." });
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found." });
        }

        if (listing.Disabled)
        {
            return BadRequest(new { error = "That guitar is already marked sold." });
        }

        var price = request.Price ?? listing.Price;
        if (price <= 0 || price > 1_000_000m)
        {
            return BadRequest(new { error = "Enter a price greater than zero." });
        }
        price = Math.Round(price, 2, MidpointRounding.AwayFromZero);

        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listing.Id!);
        if (reservation != null && reservation.IsActive && !request.AcknowledgeReservation)
        {
            return Conflict(new
            {
                error = "This guitar is on hold. Confirm you still want to sell it in person.",
                reason = "reserved",
                reservationType = ReservationType.Label(reservation.Type)
            });
        }

        var adminUserId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "";

        try
        {
            var session = await _inPersonCheckout.CreateSessionAsync(
                listing, price, fulfillment, adminUserId, request.Note);

            return Ok(new
            {
                sessionUrl = session.Url,
                sessionId = session.Id,
                listingTitle = listing.ListingTitle,
                amount = price,
                currency = listing.Currency
            });
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Stripe refused to create an in-person session for listing {ListingId}", listing.Id);
            return BadRequest(new { error = "Stripe could not start the checkout. Try again." });
        }
    }

    /// <summary>
    /// Records the sale after Stripe sends the admin back. Idempotent; the webhook or the
    /// public complete endpoint may already have written the order, in which case this
    /// simply returns it.
    /// </summary>
    [HttpPost("complete")]
    public async Task<IActionResult> Complete([FromBody] CompleteInPersonSessionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.SessionId))
        {
            return BadRequest(new { error = "Session ID is required." });
        }

        Session session;
        try
        {
            StripeConfiguration.ApiKey = _configuration["Stripe:SecretKey"];
            session = await new SessionService().GetAsync(request.SessionId, new SessionGetOptions
            {
                Expand = new List<string> { "payment_intent", "customer_details" }
            });
        }
        catch (StripeException ex)
        {
            _logger.LogError(ex, "Could not load in-person session {SessionId}", request.SessionId);
            return BadRequest(new { error = "Stripe could not find that checkout session." });
        }

        if (!InPersonCheckoutService.IsInPersonSession(session))
        {
            return BadRequest(new { error = "That session was not started from the in-person tool." });
        }

        if (session.PaymentStatus != "paid")
        {
            return BadRequest(new { error = "Payment not completed.", paymentStatus = session.PaymentStatus });
        }

        var order = await _inPersonCheckout.SettleSessionAsync(session);
        if (order == null)
        {
            return BadRequest(new { error = "Payment went through but the order could not be recorded. Check the Orders tab; the Stripe webhook will retry." });
        }

        return Ok(new
        {
            success = true,
            orderId = order.Id,
            listingTitle = order.Items.FirstOrDefault()?.ListingTitle,
            listingId = order.Items.FirstOrDefault()?.ListingId,
            amount = order.TotalAmount,
            currency = order.Currency,
            fulfillment = order.Fulfillment,
            buyerName = order.BuyerName,
            buyerEmail = order.GuestEmail,
            buyerPhone = order.BuyerPhone,
            needsDetails = order.NeedsDetails
        });
    }

    public class CreateInPersonSessionRequest
    {
        [JsonPropertyName("listingId")]
        public string ListingId { get; set; } = string.Empty;

        /// <summary>Agreed price. Null means the listing price.</summary>
        [JsonPropertyName("price")]
        public decimal? Price { get; set; }

        /// <summary>"handed_over" (default) or "ship".</summary>
        [JsonPropertyName("fulfillment")]
        public string? Fulfillment { get; set; }

        /// <summary>Required when the guitar has an active hold.</summary>
        [JsonPropertyName("acknowledgeReservation")]
        public bool AcknowledgeReservation { get; set; }

        [JsonPropertyName("note")]
        public string? Note { get; set; }
    }

    public class CompleteInPersonSessionRequest
    {
        [JsonPropertyName("sessionId")]
        public string SessionId { get; set; } = string.Empty;
    }
}
