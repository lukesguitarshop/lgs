using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/listings")]
public class MyListingsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<MyListingsController> _logger;

    public MyListingsController(
        MongoDbService mongoDbService,
        IConfiguration configuration,
        ILogger<MyListingsController> logger)
    {
        _mongoDbService = mongoDbService;
        _configuration = configuration;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetAllListings()
    {
        var listings = await _mongoDbService.GetAllMyListingsAsync();

        // One batched lookup rather than a query per card.
        var reservations = await _mongoDbService.GetActiveReservationsByListingIdsAsync(
            listings.Select(l => l.Id!));

        var userId = GetUserIdIfAuthenticated();

        return Ok(listings.Select(l =>
        {
            reservations.TryGetValue(l.Id!, out var reservation);
            var isReserved = reservation != null && reservation.IsActive;

            return new
            {
                id = l.Id,
                listing_title = l.ListingTitle,
                description = l.Description,
                condition = l.Condition,
                images = l.Images,
                reverb_link = l.ReverbLink,
                price = l.Price,
                original_price = l.OriginalPrice,
                currency = l.Currency,
                scraped_at = l.ScrapedAt,
                listed_at = l.ListedAt,
                // Reservation state only. Never the holder's identity.
                is_reserved = isReserved,
                reservation_badge = isReserved ? ReservationType.PublicBadge(reservation!.Type) : null,
                reserved_for_me = isReserved && userId != null && reservation!.UserId == userId
            };
        }));
    }

    /// <summary>
    /// The guitar shown in the homepage hero. Returns 204 when nothing is featured, so
    /// the hero can simply omit the slot rather than reason about an empty body.
    /// </summary>
    [HttpGet("featured")]
    public async Task<IActionResult> GetFeaturedListing()
    {
        var listing = await _mongoDbService.GetFeaturedListingAsync();
        if (listing == null)
        {
            return NoContent();
        }

        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listing.Id!);
        var isReserved = reservation != null && reservation.IsActive;

        return Ok(new
        {
            id = listing.Id,
            listing_title = listing.ListingTitle,
            condition = listing.Condition,
            images = listing.Images,
            price = listing.Price,
            original_price = listing.OriginalPrice,
            currency = listing.Currency,
            // Reservation state only. Never the holder's identity.
            is_reserved = isReserved,
            reservation_badge = isReserved ? ReservationType.PublicBadge(reservation!.Type) : null
        });
    }

    [HttpGet("sold")]
    public async Task<IActionResult> GetSoldListings([FromQuery] int? limit = null)
    {
        // No limit means the full sold archive: /sold fetches once and pages client-side.
        var listings = limit.HasValue && limit.Value > 0
            ? await _mongoDbService.GetRecentSoldListingsAsync(limit.Value)
            : await _mongoDbService.GetAllSoldListingsAsync();

        // Description is deliberately omitted. Neither the sold grid nor the carousel renders
        // it, and at ~2KB per listing it was roughly half the payload of the whole archive.
        // The detail endpoint still serves it.
        return Ok(listings.Select(l => new
        {
            id = l.Id,
            listing_title = l.ListingTitle,
            condition = l.Condition,
            images = l.Images,
            reverb_link = l.ReverbLink,
            price = l.Price,
            original_price = l.OriginalPrice,
            currency = l.Currency,
            scraped_at = l.ScrapedAt,
            listed_at = l.ListedAt,
            disabled = l.Disabled
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetListingById(string id)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(id);

        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(id);
        var isReserved = reservation != null && reservation.IsActive;

        var userId = GetUserIdIfAuthenticated();
        var reservedForMe = isReserved
            && !reservation!.IsUnassigned
            && userId != null
            && reservation.UserId == userId;

        return Ok(new
        {
            id = listing.Id,
            listing_title = listing.ListingTitle,
            description = listing.Description,
            condition = listing.Condition,
            images = listing.Images,
            reverb_link = listing.ReverbLink,
            price = listing.Price,
            original_price = listing.OriginalPrice,
            currency = listing.Currency,
            scraped_at = listing.ScrapedAt,
            listed_at = listing.ListedAt,
            disabled = listing.Disabled,

            // Public reservation state. Deliberately says nothing about who holds it —
            // the detail page fetches its own terms from /api/reservations/listing/{id},
            // which only returns them to the holder.
            is_reserved = isReserved,
            reservation_badge = isReserved ? ReservationType.PublicBadge(reservation!.Type) : null,
            reservation_message = isReserved ? ReservationService.GenericHoldMessage : null,
            reserved_for_me = reservedForMe,
            accepts_offers = !isReserved
        });
    }

    /// <summary>
    /// Called by the listing page once it has loaded in a browser. Counts one view per
    /// visitor per listing per day; crawlers and the shop's own admins are left out.
    /// Always answers 204 so the page learns nothing about whether it counted.
    /// </summary>
    [HttpPost("{id}/view")]
    public async Task<IActionResult> RecordView(string id)
    {
        try
        {
            var userAgent = Request.Headers.UserAgent.ToString();
            if (ListingViewRules.IsBot(userAgent)) return NoContent();
            if (User.FindFirst("is_admin")?.Value == "true") return NoContent();
            if (!MongoDB.Bson.ObjectId.TryParse(id, out _)) return NoContent();

            var listing = await _mongoDbService.GetMyListingByIdAsync(id);
            if (listing == null) return NoContent();

            var ip = ListingViewRules.ClientIp(
                Request.Headers["Fly-Client-IP"].ToString(),
                Request.Headers["X-Forwarded-For"].ToString(),
                HttpContext.Connection.RemoteIpAddress?.ToString());
            var salt = _configuration["ListingViews:Salt"] ?? _configuration["Jwt:SecretKey"] ?? "listing-views";

            await _mongoDbService.RecordListingViewAsync(
                id, ListingViewRules.VisitorKey(ip, userAgent, salt, DateTime.UtcNow));

            // The customer's own feed gets one line per guitar per day, however many
            // devices or reloads were involved.
            var userId = GetUserIdIfAuthenticated();
            if (userId != null)
            {
                await _mongoDbService.LogActivityOncePerDayAsync(
                    userId, "listing_view", $"Viewed {listing.ListingTitle}", id);
            }
        }
        catch (Exception ex)
        {
            // A view count must never surface as an error on the listing page.
            _logger.LogWarning(ex, "Failed to record a view for listing {ListingId}", id);
        }

        return NoContent();
    }

    private string? GetUserIdIfAuthenticated()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}
