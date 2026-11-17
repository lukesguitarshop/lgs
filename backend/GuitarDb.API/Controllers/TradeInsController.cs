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
    private readonly IFileStorageService _fileStorage;

    public TradeInsController(MongoDbService mongoDbService, EmailService emailService,
        ILogger<TradeInsController> logger, IFileStorageService fileStorage)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _logger = logger;
        _fileStorage = fileStorage;
    }

    private string? GetUserId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    // The browser resizes photos before sending, so this is a backstop: 8 photos at the
    // per-photo limit plus form overhead.
    private const long MaxSubmitBytes = 85 * 1024 * 1024;

    [HttpPost]
    [RequestSizeLimit(MaxSubmitBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxSubmitBytes)]
    public async Task<IActionResult> Submit([FromForm] SubmitTradeInRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        // Everything is checked before anything is written. A request used to be saved
        // first and its photos checked after, so one rejected photo left an empty
        // trade-in behind every time the customer retried.
        if (string.IsNullOrWhiteSpace(request.Brand) ||
            string.IsNullOrWhiteSpace(request.Model) ||
            string.IsNullOrWhiteSpace(request.Condition))
        {
            return BadRequest(new { error = "Brand, model, and condition are required" });
        }
        var brand = request.Brand.Trim();
        var model = request.Model.Trim();
        var notes = request.Notes?.Trim() ?? string.Empty;
        if (brand.Length > 100)
            return BadRequest(new { error = "Brand must be 100 characters or fewer" });
        if (model.Length > 100)
            return BadRequest(new { error = "Model must be 100 characters or fewer" });
        if (notes.Length > 1000)
            return BadRequest(new { error = "Notes must be 1000 characters or fewer" });
        if (!TradeInRules.Conditions.Contains(request.Condition))
            return BadRequest(new { error = "Invalid condition" });

        var images = request.Photos ?? new List<IFormFile>();
        if (images.Count == 0)
            return BadRequest(new { error = "At least one photo is required" });
        if (images.Count > TradeInRules.MaxPhotos)
            return BadRequest(new { error = $"You can add up to {TradeInRules.MaxPhotos} photos" });
        foreach (var image in images)
        {
            if (image.Length == 0)
                return BadRequest(new { error = $"{image.FileName} is empty. Remove it and try again." });
            if (image.Length > TradeInRules.MaxPhotoBytes)
                return BadRequest(new { error = $"{image.FileName} is over 10MB. Remove it or pick a smaller photo." });
            if (!TradeInRules.PhotoContentTypes.Contains((image.ContentType ?? string.Empty).ToLowerInvariant()))
                return BadRequest(new { error = $"{image.FileName} isn't a JPEG, PNG, GIF, or WebP photo." });
        }

        var user = await _mongoDbService.GetUserByIdAsync(userId);
        if (user == null) return Unauthorized(new { error = "User not found" });

        // A double-tap, or a retry after a slow upload that actually went through,
        // lands on the request that already exists.
        var duplicate = await _mongoDbService.FindRecentDuplicateTradeInAsync(
            userId, brand, model, request.Condition, DateTime.UtcNow.AddMinutes(-10));
        if (duplicate != null) return Ok(new { id = duplicate.Id });

        // Photos go up first, under an id chosen now; the record is inserted once, complete.
        var id = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
        var photos = new List<TradeInPhoto>();
        try
        {
            foreach (var image in images)
            {
                var key = $"trade-ins/{id}/{Guid.NewGuid()}{Path.GetExtension(image.FileName)}";
                using var imageStream = image.OpenReadStream();
                var photoUrl = await _fileStorage.UploadAsync(key, imageStream, image.ContentType);
                photos.Add(new TradeInPhoto { Url = photoUrl, OriginalFileName = image.FileName });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Photo upload failed for trade-in submission by user {UserId}", userId);
            await CleanUpPhotosAsync(id);
            return StatusCode(500, new { error = "Your photos didn't upload. Nothing was submitted, so please try again." });
        }

        TradeInRequest tradeIn;
        try
        {
            tradeIn = await _mongoDbService.CreateTradeInRequestAsync(new TradeInRequest
            {
                Id = id,
                UserId = userId,
                Email = user.Email ?? string.Empty,
                Brand = brand,
                Model = model,
                Condition = request.Condition,
                Notes = notes,
                Photos = photos
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Saving trade-in submission failed for user {UserId}", userId);
            await CleanUpPhotosAsync(id);
            return StatusCode(500, new { error = "Something went wrong saving your trade-in. Nothing was submitted, so please try again." });
        }

        // Fire-and-forget email notifications
        _ = _emailService.SendTradeInSubmittedAsync(tradeIn.Email, tradeIn.Id!, tradeIn.Brand, tradeIn.Model);
        _ = _emailService.SendTradeInSubmittedAdminAsync(tradeIn.Id!, tradeIn.Brand, tradeIn.Model,
            tradeIn.Condition, tradeIn.Photos.Count, tradeIn.Email);

        return Ok(new { id = tradeIn.Id });
    }

    private async Task CleanUpPhotosAsync(string id)
    {
        try { await _fileStorage.DeletePrefixAsync($"trade-ins/{id}/"); }
        catch (Exception ex) { _logger.LogWarning(ex, "Failed to clean up photos for abandoned trade-in {Id}", id); }
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null || req.UserId != userId) return NotFound(new { error = "Trade-in not found" });
        if (!TradeInRules.CanCustomerCancel(req))
            return BadRequest(new { error = "This trade-in can't be cancelled any more. Send me a message and I'll sort it out." });

        req.Status = TradeInStatus.Cancelled;
        await _mongoDbService.UpdateTradeInRequestAsync(req);
        return Ok(MapToDto(req));
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

    [HttpPost("{id}/return-address")]
    public async Task<IActionResult> SetReturnAddress(string id, [FromBody] TradeInAddressDto request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null || req.UserId != userId) return NotFound(new { error = "Trade-in not found" });
        if (!TradeInRules.CanSetReturnAddress(req))
            return BadRequest(new { error = req.Shipping.LabelUrl != null
                ? "Your label is already made, so the address can't change here. Send me a message and I'll sort it out."
                : "A return address can only be added once you've accepted an offer." });

        var address = new UserShippingAddress
        {
            FullName = request.FullName?.Trim() ?? string.Empty,
            Line1 = request.Line1?.Trim() ?? string.Empty,
            Line2 = string.IsNullOrWhiteSpace(request.Line2) ? null : request.Line2.Trim(),
            City = request.City?.Trim() ?? string.Empty,
            State = request.State?.Trim() ?? string.Empty,
            PostalCode = request.PostalCode?.Trim() ?? string.Empty,
            Country = request.Country?.Trim() ?? string.Empty
        };
        var required = new[] { address.FullName, address.Line1, address.City, address.State, address.PostalCode, address.Country };
        if (required.Any(string.IsNullOrEmpty))
            return BadRequest(new { error = "Name, address, city, state, postal code, and country are required" });
        if (required.Append(address.Line2 ?? string.Empty).Any(v => v.Length > 200))
            return BadRequest(new { error = "Each address field must be 200 characters or fewer" });

        var changed = req.Shipping.ReturnAddress != null;
        req.Shipping.ReturnAddress = address;
        req.Shipping.ReturnAddressAt = DateTime.UtcNow;
        await _mongoDbService.UpdateTradeInRequestAsync(req);

        _ = _emailService.SendTradeInReturnAddressAdminAsync(req.Id!, req.Brand, req.Model, req.Email, address, changed);
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
            Status = TradeInRules.EffectiveStatus(req),
            CanCancel = TradeInRules.CanCustomerCancel(req),
            Photos = req.Photos.Select(p => new TradeInPhotoDto { Url = p.Url }).ToList(),
            ActiveOffer = activeDto,
            Shipping = new TradeInShippingDto
            {
                ReturnAddress = TradeInAddressDto.From(req.Shipping.ReturnAddress),
                CanEditReturnAddress = TradeInRules.CanSetReturnAddress(req),
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
