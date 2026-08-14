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

    public MyListingsController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
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

    [HttpGet("sold")]
    public async Task<IActionResult> GetSoldListings([FromQuery] int? limit = null)
    {
        var listings = limit.HasValue && limit.Value > 0
            ? await _mongoDbService.GetRecentSoldListingsAsync(limit.Value)
            : await _mongoDbService.GetRecentSoldListingsAsync(100); // Default max for all sold page

        return Ok(listings.Select(l => new
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

    private string? GetUserIdIfAuthenticated()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}
