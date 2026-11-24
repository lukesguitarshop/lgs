using GuitarDb.API.Attributes;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

/// <summary>
/// Admin management of checkout discount codes: list them, add one by hand, switch one
/// off. The newsletter job creates its own codes through MongoDbService directly.
/// </summary>
[ApiController]
[Route("api/admin/discount-codes")]
[AdminAuthorize]
public class AdminDiscountCodesController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;

    public AdminDiscountCodesController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        return Ok(await _mongoDbService.GetDiscountCodesAsync());
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateDiscountCodeRequest request)
    {
        var code = DiscountRules.Normalize(request.Code);
        if (code.Length < 4 || code.Length > 20 || code.Any(c => !(char.IsAsciiLetterOrDigit(c) || c == '-')))
        {
            return BadRequest(new { error = "A code is 4 to 20 letters, numbers or dashes." });
        }

        if (request.PercentOff <= 0m || request.PercentOff > 100m)
        {
            return BadRequest(new { error = "Percent off must be between 0 and 100." });
        }

        var startsAt = request.StartsAt?.ToUniversalTime() ?? DateTime.UtcNow;
        var expiresAt = request.ExpiresAt.ToUniversalTime();
        if (expiresAt <= startsAt)
        {
            return BadRequest(new { error = "The expiry must be after the start." });
        }

        var discountCode = new DiscountCode
        {
            Code = code,
            PercentOff = request.PercentOff,
            StartsAt = startsAt,
            ExpiresAt = expiresAt,
            MaxUses = request.MaxUses,
            MaxUsesPerUser = request.MaxUsesPerUser,
            Source = DiscountCodeSource.Manual
        };

        if (!await _mongoDbService.TryCreateDiscountCodeAsync(discountCode))
        {
            return Conflict(new { error = "That code already exists." });
        }

        return Ok(discountCode);
    }

    [HttpPatch("{id}/active")]
    public async Task<IActionResult> SetActive(string id, [FromBody] SetDiscountCodeActiveRequest request)
    {
        if (!MongoDB.Bson.ObjectId.TryParse(id, out _)
            || !await _mongoDbService.SetDiscountCodeActiveAsync(id, request.Active))
        {
            return NotFound(new { error = "Discount code not found." });
        }

        return Ok(new { success = true });
    }
}

public class CreateDiscountCodeRequest
{
    public string? Code { get; set; }
    public decimal PercentOff { get; set; }
    public DateTime? StartsAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public int? MaxUses { get; set; }
    public int? MaxUsesPerUser { get; set; } = 1;
}

public class SetDiscountCodeActiveRequest
{
    public bool Active { get; set; }
}
