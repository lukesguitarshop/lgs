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
            ReservationId = item.ReservationId,
            // Price is the balance due — always computed server-side from the
            // reservation's locked terms, never from anything the browser sent.
            Price = item.Price,
            DepositPaid = item.DepositPaid,
            TradeInCredit = item.TradeInCredit,
            AgreedPrice = item.Price + item.DepositPaid + item.TradeInCredit,
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
    public string? ReservationId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Image { get; set; }

    /// <summary>Balance due — what the customer actually pays for this line.</summary>
    public decimal Price { get; set; }

    /// <summary>Full agreed price, shown as the top line before credits.</summary>
    public decimal AgreedPrice { get; set; }

    public decimal DepositPaid { get; set; }
    public decimal TradeInCredit { get; set; }
    public string Currency { get; set; } = string.Empty;
    public bool IsLocked { get; set; }
    public DateTime CreatedAt { get; set; }

    /// <summary>Null means the lock never expires (deposit-backed).</summary>
    public DateTime? ExpiresAt { get; set; }
}
