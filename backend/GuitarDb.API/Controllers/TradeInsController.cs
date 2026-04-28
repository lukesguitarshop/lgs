using GuitarDb.API.DTOs;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/trade-ins")]
[Authorize]
public class TradeInsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly ILogger<TradeInsController> _logger;
    private readonly IWebHostEnvironment _environment;

    public TradeInsController(MongoDbService mongoDbService, EmailService emailService,
        ILogger<TradeInsController> logger, IWebHostEnvironment environment)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _logger = logger;
        _environment = environment;
    }

    private string? GetUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpPost]
    [RequestSizeLimit(25 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 25 * 1024 * 1024)]
    public async Task<IActionResult> Submit([FromForm] SubmitTradeInRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (string.IsNullOrWhiteSpace(request.Brand) ||
            string.IsNullOrWhiteSpace(request.Model) ||
            string.IsNullOrWhiteSpace(request.Condition))
        {
            return BadRequest(new { error = "Brand, model, and condition are required" });
        }
        var allowedConditions = new[] { "Mint", "Excellent", "Very Good", "Good", "Fair" };
        if (!allowedConditions.Contains(request.Condition))
        {
            return BadRequest(new { error = "Invalid condition" });
        }
        if (request.Photos == null || request.Photos.Count == 0)
        {
            return BadRequest(new { error = "At least one photo is required" });
        }

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user == null) return Unauthorized(new { error = "User not found" });

        var tradeIn = await _mongoDbService.CreateTradeInRequestAsync(new TradeInRequest
        {
            UserId = userId,
            Email = user.Email ?? string.Empty,
            Brand = request.Brand.Trim(),
            Model = request.Model.Trim(),
            Condition = request.Condition,
            Notes = request.Notes?.Trim() ?? string.Empty
        });

        // Save photos under a folder named by the request id
        var photos = new List<TradeInPhoto>();
        var allowedTypes = new[] { "image/jpeg", "image/png", "image/gif", "image/webp" };
        var imagesToProcess = request.Photos.Take(8).ToList();
        foreach (var image in imagesToProcess)
        {
            if (image.Length > 5 * 1024 * 1024)
                return BadRequest(new { error = "Each photo must be under 5MB" });
            if (!allowedTypes.Contains(image.ContentType.ToLower()))
                return BadRequest(new { error = "Photos must be JPEG, PNG, GIF, or WebP" });

            var uploadsRoot = Path.Combine(
                _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"),
                "uploads", "trade-ins", tradeIn.Id!);
            Directory.CreateDirectory(uploadsRoot);

            var ext = Path.GetExtension(image.FileName);
            var fileName = $"{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(uploadsRoot, fileName);
            using (var stream = new FileStream(filePath, FileMode.Create))
                await image.CopyToAsync(stream);

            var baseUrl = $"{Request.Scheme}://{Request.Host}";
            photos.Add(new TradeInPhoto
            {
                Url = $"{baseUrl}/uploads/trade-ins/{tradeIn.Id}/{fileName}",
                OriginalFileName = image.FileName
            });
        }
        tradeIn.Photos = photos;
        await _mongoDbService.UpdateTradeInRequestAsync(tradeIn);

        // Fire-and-forget email notification
        _ = _emailService.SendTradeInSubmittedAsync(tradeIn.Email, tradeIn.Id!, tradeIn.Brand, tradeIn.Model);

        return Ok(new { id = tradeIn.Id });
    }

    [HttpGet("me")]
    public async Task<IActionResult> GetMine()
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });
        var requests = await _mongoDbService.GetTradeInRequestsByUserAsync(userId);
        return Ok(requests.Select(MapToDto));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetOne(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null || req.UserId != userId) return NotFound(new { error = "Trade-in not found" });
        return Ok(MapToDto(req));
    }

    [HttpPost("{id}/accept")]
    public async Task<IActionResult> Accept(string id, [FromBody] AcceptTradeInOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null || req.UserId != userId) return NotFound(new { error = "Trade-in not found" });

        var active = req.Offers.LastOrDefault();
        if (active == null || active.AcceptedAt != null || active.DeclinedAt != null)
            return BadRequest(new { error = "No active offer to accept" });
        if (active.ExpiresAt < DateTime.UtcNow)
            return BadRequest(new { error = "This offer has expired" });
        if (request.Type != TradeInOfferType.Cash && request.Type != TradeInOfferType.Credit)
            return BadRequest(new { error = "Type must be 'cash' or 'credit'" });
        if (request.Type == TradeInOfferType.Cash && string.IsNullOrWhiteSpace(request.PaypalEmail))
            return BadRequest(new { error = "PayPal email required for cash offers" });

        active.AcceptedType = request.Type;
        active.AcceptedAt = DateTime.UtcNow;
        active.PaypalEmail = request.Type == TradeInOfferType.Cash ? request.PaypalEmail : null;
        req.Status = TradeInStatus.Accepted;
        await _mongoDbService.UpdateTradeInRequestAsync(req);

        _ = _emailService.SendTradeInAcceptedShippingInstructionsAsync(req.Email, req.Id!, req.Brand, req.Model);
        return Ok(MapToDto(req));
    }

    [HttpPost("{id}/decline")]
    public async Task<IActionResult> Decline(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null || req.UserId != userId) return NotFound(new { error = "Trade-in not found" });

        var active = req.Offers.LastOrDefault();
        if (active == null || active.AcceptedAt != null || active.DeclinedAt != null)
            return BadRequest(new { error = "No active offer to decline" });

        active.DeclinedAt = DateTime.UtcNow;
        req.Status = TradeInStatus.Declined;
        await _mongoDbService.UpdateTradeInRequestAsync(req);

        _ = _emailService.SendTradeInDeclinedAdminAsync(req.Brand, req.Model, req.Email);
        return Ok(MapToDto(req));
    }

    private static TradeInRequestDto MapToDto(TradeInRequest req)
    {
        var active = req.Offers.LastOrDefault();
        TradeInOfferDto? activeDto = null;
        if (active != null)
        {
            activeDto = new TradeInOfferDto
            {
                CashOffer = active.CashOffer,
                StoreCreditOffer = active.StoreCreditOffer,
                ExpiresAt = active.ExpiresAt,
                AcceptedType = active.AcceptedType,
                AcceptedAt = active.AcceptedAt,
                DeclinedAt = active.DeclinedAt,
                IsExpired = active.AcceptedAt == null && active.DeclinedAt == null
                            && active.ExpiresAt < DateTime.UtcNow
            };
        }
        return new TradeInRequestDto
        {
            Id = req.Id!,
            Brand = req.Brand,
            Model = req.Model,
            Condition = req.Condition,
            Notes = req.Notes,
            Status = req.Status,
            Photos = req.Photos.Select(p => new TradeInPhotoDto { Url = p.Url }).ToList(),
            ActiveOffer = activeDto,
            Shipping = new TradeInShippingDto
            {
                LabelUrl = req.Shipping.LabelUrl,
                ReceivedAt = req.Shipping.ReceivedAt,
                InspectedAt = req.Shipping.InspectedAt
            },
            Payout = new TradeInPayoutDto
            {
                CompletedAt = req.Payout.CompletedAt,
                PaidAt = req.Payout.PaidAt
            },
            CreatedAt = req.CreatedAt
        };
    }
}
