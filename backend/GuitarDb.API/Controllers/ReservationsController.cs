using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

/// <summary>
/// Customer-facing reservation state.
///
/// Privacy rule enforced here: nothing on this controller ever reveals WHO a listing is
/// held for. A user who is not the holder gets only "on hold" plus the badge type.
/// </summary>
[ApiController]
[Route("api/reservations")]
public class ReservationsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<ReservationsController> _logger;

    public ReservationsController(MongoDbService mongoDbService, ILogger<ReservationsController> logger)
    {
        _mongoDbService = mongoDbService;
        _logger = logger;
    }

    /// <summary>
    /// Reservation state for a listing, from the perspective of the caller.
    ///
    /// Returns the full terms only when the caller IS the reserved user. Everyone else
    /// (including logged-out visitors) gets the anonymous "on hold" shape.
    /// </summary>
    [HttpGet("listing/{listingId}")]
    public async Task<IActionResult> GetForListing(string listingId)
    {
        var reservation = await _mongoDbService.GetActiveReservationByListingAsync(listingId);

        if (reservation == null || !reservation.IsActive)
        {
            return Ok(new { is_reserved = false });
        }

        var userId = GetUserIdIfAuthenticated();
        var isHolder = !reservation.IsUnassigned && userId == reservation.UserId;

        if (!isHolder)
        {
            // Anonymous shape. No name, no email, no initials, no user id.
            return Ok(ReservationService.BuildPublicView(reservation));
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(listingId);

        return Ok(new
        {
            is_reserved = true,
            is_mine = true,
            badge = ReservationType.PublicBadge(reservation.Type),
            reservation = ReservationService.BuildReservedUserView(reservation, listing?.Currency ?? "USD")
        });
    }

    /// <summary>All active reservations belonging to the caller.</summary>
    [HttpGet("mine")]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserIdIfAuthenticated();
        if (userId == null) return Unauthorized(new { error = "Authentication required" });

        var reservations = await _mongoDbService.GetReservationsByUserAsync(userId, activeOnly: true);
        var result = new List<object>();

        foreach (var r in reservations)
        {
            var listing = await _mongoDbService.GetMyListingByIdAsync(r.ListingId);
            result.Add(new
            {
                listing_id = r.ListingId,
                listing_title = listing?.ListingTitle,
                listing_image = listing?.Images.FirstOrDefault(),
                badge = ReservationType.PublicBadge(r.Type),
                reservation = ReservationService.BuildReservedUserView(r, listing?.Currency ?? "USD")
            });
        }

        return Ok(result);
    }

    private string? GetUserIdIfAuthenticated()
    {
        if (User.Identity?.IsAuthenticated != true) return null;
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}
