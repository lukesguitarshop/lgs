using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/cart")]
[Authorize]
public class CartController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<CartController> _logger;

    public CartController(
        MongoDbService mongoDbService,
        ILogger<CartController> logger)
    {
        _mongoDbService = mongoDbService;
        _logger = logger;
    }

    /// <summary>
    /// Get pending cart items for current user (locked items from accepted offers)
    /// </summary>
    [HttpGet("pending")]
    public async Task<IActionResult> GetPendingCartItems()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var pendingItems = await _mongoDbService.GetPendingCartItemsByUserAsync(userId);

        var result = pendingItems.Select(item => new PendingCartItemDto
        {
            Id = item.Id!,
            ListingId = item.ListingId,
            OfferId = item.OfferId,
            Title = item.ListingTitle,
            Image = item.ListingImage,
            Price = item.Price,
            Currency = item.Currency,
            IsLocked = true,
            CreatedAt = item.CreatedAt,
            ExpiresAt = item.ExpiresAt
        }).ToList();

        return Ok(result);
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }
}

public class PendingCartItemDto
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string OfferId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Image { get; set; }
    public decimal Price { get; set; }
    public string Currency { get; set; } = string.Empty;
    public bool IsLocked { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}
