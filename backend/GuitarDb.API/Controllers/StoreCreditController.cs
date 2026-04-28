using GuitarDb.API.DTOs;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/store-credit")]
[Authorize]
public class StoreCreditController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;

    public StoreCreditController(MongoDbService mongoDbService)
    {
        _mongoDbService = mongoDbService;
    }

    private string? GetUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet("me")]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });
        var sc = await _mongoDbService.GetStoreCreditByUserAsync(userId);
        if (sc == null) return Ok(new StoreCreditDto { Balance = 0 });
        return Ok(new StoreCreditDto
        {
            Balance = sc.Balance,
            History = sc.History
                .OrderByDescending(h => h.CreatedAt)
                .Select(h => new StoreCreditEntryDto
                {
                    Type = h.Type,
                    Amount = h.Amount,
                    Reason = h.Reason,
                    CreatedAt = h.CreatedAt
                }).ToList()
        });
    }
}
