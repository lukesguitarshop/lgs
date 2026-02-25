using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/favorites")]
[Authorize]
public class FavoritesController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<FavoritesController> _logger;

    public FavoritesController(
        MongoDbService mongoDbService,
        ILogger<FavoritesController> logger)
    {
        _mongoDbService = mongoDbService;
        _logger = logger;
    }

    /// <summary>
    /// Get all favorites for current user with listing details
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetFavorites()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var favorites = await _mongoDbService.GetUserFavoritesAsync(userId);
        var listingIds = favorites.Select(f => f.ListingId).ToList();
        var listings = await _mongoDbService.GetListingsByIdsAsync(listingIds);

        var result = favorites.Select(f =>
        {
            var listing = listings.FirstOrDefault(l => l.Id == f.ListingId);
            return new FavoriteDto
            {
                Id = f.Id!,
                ListingId = f.ListingId,
                CreatedAt = f.CreatedAt,
                Listing = listing != null ? MapToListingSummary(listing) : null
            };
        }).ToList();

        return Ok(result);
    }

    /// <summary>
    /// Add listing to favorites
    /// </summary>
    [HttpPost("{listingId}")]
    public async Task<IActionResult> AddFavorite(string listingId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var listing = await _mongoDbService.GetMyListingByIdAsync(listingId);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        var alreadyFavorited = await _mongoDbService.IsFavoriteAsync(userId, listingId);
        if (alreadyFavorited)
        {
            return BadRequest(new { error = "Listing already in favorites" });
        }

        var favorite = await _mongoDbService.AddFavoriteAsync(userId, listingId);

        return Ok(new FavoriteDto
        {
            Id = favorite.Id!,
            ListingId = favorite.ListingId,
            CreatedAt = favorite.CreatedAt,
            Listing = MapToListingSummary(listing)
        });
    }

    /// <summary>
    /// Remove listing from favorites
    /// </summary>
    [HttpDelete("{listingId}")]
    public async Task<IActionResult> RemoveFavorite(string listingId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var removed = await _mongoDbService.RemoveFavoriteAsync(userId, listingId);
        if (!removed)
        {
            return NotFound(new { error = "Favorite not found" });
        }

        return Ok(new { message = "Favorite removed" });
    }

    /// <summary>
    /// Check if listing is favorited by current user
    /// </summary>
    [HttpGet("check/{listingId}")]
    public async Task<IActionResult> CheckFavorite(string listingId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var isFavorited = await _mongoDbService.IsFavoriteAsync(userId, listingId);

        return Ok(new { isFavorited });
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    private static ListingSummaryDto MapToListingSummary(MyListing listing)
    {
        return new ListingSummaryDto
        {
            Id = listing.Id!,
            ListingTitle = listing.ListingTitle,
            Price = listing.Price,
            Currency = listing.Currency,
            Condition = listing.Condition,
            Image = listing.Images?.FirstOrDefault(),
            Disabled = listing.Disabled
        };
    }
}

public class FavoriteDto
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public ListingSummaryDto? Listing { get; set; }
}

public class ListingSummaryDto
{
    public string Id { get; set; } = string.Empty;
    public string ListingTitle { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public string Currency { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string? Image { get; set; }
    public bool Disabled { get; set; }
}
