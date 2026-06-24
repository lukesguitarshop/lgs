using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/activity")]
[Authorize]
public class ActivityController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly ILogger<ActivityController> _logger;

    public ActivityController(MongoDbService mongoDbService, ILogger<ActivityController> logger)
    {
        _mongoDbService = mongoDbService;
        _logger = logger;
    }

    /// <summary>
    /// Record a client-side activity event for the current user.
    /// Currently used for "add_to_cart" since the cart lives in localStorage.
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> LogActivity([FromBody] LogActivityRequest request)
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(userId)) return Unauthorized(new { error = "Invalid token" });

        // Only allow client-originated event types we expect, to avoid log spam/abuse.
        if (request.Type != "add_to_cart")
        {
            return BadRequest(new { error = "Unsupported activity type" });
        }

        var listingTitle = string.IsNullOrWhiteSpace(request.ListingTitle)
            ? "an item"
            : request.ListingTitle.Trim();
        if (listingTitle.Length > 120) listingTitle = listingTitle[..120];

        await _mongoDbService.LogActivityAsync(
            userId,
            "add_to_cart",
            $"Added {listingTitle} to cart",
            request.ListingId);

        return Ok(new { message = "logged" });
    }
}

public class LogActivityRequest
{
    public string Type { get; set; } = string.Empty;
    public string? ListingId { get; set; }
    public string? ListingTitle { get; set; }
}
