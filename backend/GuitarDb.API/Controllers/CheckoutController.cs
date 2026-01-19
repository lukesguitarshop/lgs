using GuitarDb.API.DTOs;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using Stripe;
using Stripe.Checkout;

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

        var listingIds = request.Items.Select(i => i.ListingId).ToList();
        var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);

        if (listings.Count == 0)
        {
            return BadRequest(new { error = "No valid listings found" });
        }

        var listingMap = listings.ToDictionary(l => l.Id!, l => l);

        var lineItems = new List<SessionLineItemOptions>();
        foreach (var item in request.Items)
        {
            if (!listingMap.TryGetValue(item.ListingId, out var listing))
            {
                _logger.LogWarning("Listing not found: {ListingId}", item.ListingId);
                continue;
            }

            lineItems.Add(new SessionLineItemOptions
            {
                PriceData = new SessionLineItemPriceDataOptions
                {
                    Currency = listing.Currency.ToLower(),
                    UnitAmount = (long)(listing.Price * 100),
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
            SuccessUrl = _configuration["Stripe:SuccessUrl"] ?? "http://localhost:3000/checkout/success",
            CancelUrl = _configuration["Stripe:CancelUrl"] ?? "http://localhost:3000/checkout/cancel"
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
}
