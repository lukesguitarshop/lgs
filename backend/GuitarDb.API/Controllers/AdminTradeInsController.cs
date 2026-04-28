using GuitarDb.API.Attributes;
using GuitarDb.API.DTOs;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/admin/trade-ins")]
[AdminAuthorize]
public class AdminTradeInsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly ILogger<AdminTradeInsController> _logger;
    private readonly IWebHostEnvironment _environment;

    public AdminTradeInsController(MongoDbService mongoDbService, EmailService emailService,
        ILogger<AdminTradeInsController> logger, IWebHostEnvironment environment)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _logger = logger;
        _environment = environment;
    }

    private string? GetAdminId() => User.FindFirst(ClaimTypes.NameIdentifier)?.Value;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status)
    {
        var requests = await _mongoDbService.GetAllTradeInRequestsAsync(status);
        return Ok(requests.Select(r => new AdminTradeInListItemDto
        {
            Id = r.Id!,
            Email = r.Email,
            Brand = r.Brand,
            Model = r.Model,
            Condition = r.Condition,
            Status = r.Status,
            CreatedAt = r.CreatedAt
        }));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetDetail(string id)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });

        var active = req.Offers.LastOrDefault();
        return Ok(new AdminTradeInDetailDto
        {
            Id = req.Id!,
            UserId = req.UserId,
            Email = req.Email,
            Brand = req.Brand,
            Model = req.Model,
            Condition = req.Condition,
            Notes = req.Notes,
            Status = req.Status,
            Photos = req.Photos.Select(p => new TradeInPhotoDto { Url = p.Url }).ToList(),
            ActiveOffer = active == null ? null : new TradeInOfferDto
            {
                CashOffer = active.CashOffer,
                StoreCreditOffer = active.StoreCreditOffer,
                ExpiresAt = active.ExpiresAt,
                AcceptedType = active.AcceptedType,
                AcceptedAt = active.AcceptedAt,
                DeclinedAt = active.DeclinedAt,
                IsExpired = active.AcceptedAt == null && active.DeclinedAt == null
                            && active.ExpiresAt < DateTime.UtcNow
            },
            AllOffers = req.Offers.Select(o => new TradeInOfferDto
            {
                CashOffer = o.CashOffer,
                StoreCreditOffer = o.StoreCreditOffer,
                ExpiresAt = o.ExpiresAt,
                AcceptedType = o.AcceptedType,
                AcceptedAt = o.AcceptedAt,
                DeclinedAt = o.DeclinedAt,
                IsExpired = o.AcceptedAt == null && o.DeclinedAt == null && o.ExpiresAt < DateTime.UtcNow
            }).ToList(),
            PaypalEmail = active?.PaypalEmail,
            Shipping = new TradeInShippingDto
            {
                LabelUrl = req.Shipping.LabelUrl,
                ReceivedAt = req.Shipping.ReceivedAt,
                InspectedAt = req.Shipping.InspectedAt
            },
            InspectionNotes = req.Shipping.InspectionNotes,
            Payout = new TradeInPayoutDto
            {
                CompletedAt = req.Payout.CompletedAt,
                PaidAt = req.Payout.PaidAt
            },
            PaypalTransactionId = req.Payout.PaypalTransactionId,
            CreatedAt = req.CreatedAt
        });
    }

    [HttpPost("{id}/offer")]
    public async Task<IActionResult> CreateOffer(string id, [FromBody] CreateTradeInOfferRequest request)
    {
        var adminId = GetAdminId();
        if (adminId == null) return Unauthorized(new { error = "Invalid token" });
        if (request.CashOffer < 0 || request.StoreCreditOffer < 0)
            return BadRequest(new { error = "Offers must be non-negative" });
        if (request.ExpirationDays <= 0 || request.ExpirationDays > 30)
            return BadRequest(new { error = "ExpirationDays must be between 1 and 30" });

        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });

        req.Offers.Add(new TradeInOffer
        {
            CashOffer = request.CashOffer,
            StoreCreditOffer = request.StoreCreditOffer,
            ExpiresAt = DateTime.UtcNow.AddDays(request.ExpirationDays),
            CreatedByAdminId = adminId
        });
        req.Status = TradeInStatus.Offered;
        await _mongoDbService.UpdateTradeInRequestAsync(req);

        _ = _emailService.SendTradeInOfferReadyAsync(req.Email, req.Id!, req.Brand, req.Model,
            request.CashOffer, request.StoreCreditOffer, req.Offers.Last().ExpiresAt);

        return Ok(new { id = req.Id });
    }

    [HttpPost("{id}/label")]
    [RequestSizeLimit(10 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 10 * 1024 * 1024)]
    public async Task<IActionResult> UploadLabel(string id, IFormFile label)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });
        if (label == null || label.Length == 0) return BadRequest(new { error = "Label file required" });
        if (label.ContentType != "application/pdf") return BadRequest(new { error = "Label must be a PDF" });
        if (label.Length > 10 * 1024 * 1024) return BadRequest(new { error = "Label must be under 10MB" });

        var dir = Path.Combine(
            _environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"),
            "uploads", "trade-ins", req.Id!);
        Directory.CreateDirectory(dir);
        var labelPath = Path.Combine(dir, "label.pdf");
        using (var stream = new FileStream(labelPath, FileMode.Create))
            await label.CopyToAsync(stream);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        req.Shipping.LabelUrl = $"{baseUrl}/uploads/trade-ins/{req.Id}/label.pdf";
        req.Shipping.LabelUploadedAt = DateTime.UtcNow;
        await _mongoDbService.UpdateTradeInRequestAsync(req);
        return Ok(new { labelUrl = req.Shipping.LabelUrl });
    }

    [HttpPost("{id}/mark-received")]
    public async Task<IActionResult> MarkReceived(string id)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });
        req.Shipping.ReceivedAt = DateTime.UtcNow;
        req.Status = TradeInStatus.Received;
        await _mongoDbService.UpdateTradeInRequestAsync(req);
        _ = _emailService.SendTradeInReceivedAsync(req.Email, req.Id!, req.Brand, req.Model);
        return Ok(new { id = req.Id });
    }

    [HttpPost("{id}/mark-inspected")]
    public async Task<IActionResult> MarkInspected(string id, [FromBody] MarkInspectedRequest request)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });
        req.Shipping.InspectedAt = DateTime.UtcNow;
        req.Shipping.InspectionNotes = request.Notes;
        req.Status = TradeInStatus.Inspected;
        await _mongoDbService.UpdateTradeInRequestAsync(req);
        return Ok(new { id = req.Id });
    }

    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(string id)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });

        var accepted = req.Offers.LastOrDefault(o => o.AcceptedAt != null);
        if (accepted == null) return BadRequest(new { error = "No accepted offer" });

        req.Payout.CompletedAt = DateTime.UtcNow;
        req.Status = TradeInStatus.Completed;

        if (accepted.AcceptedType == TradeInOfferType.Credit)
        {
            var sc = await _mongoDbService.CreateOrCreditUserAsync(
                req.UserId, accepted.StoreCreditOffer,
                $"trade-in {req.Id}", req.Id);
            req.Payout.StoreCreditId = sc.Id;
            await _mongoDbService.UpdateTradeInRequestAsync(req);
            _ = _emailService.SendTradeInCreditIssuedAsync(req.Email, req.Brand, req.Model,
                accepted.StoreCreditOffer, sc.Balance);
        }
        else
        {
            await _mongoDbService.UpdateTradeInRequestAsync(req);
            // Cash path: admin still needs to mark-paid separately
        }
        return Ok(new { id = req.Id });
    }

    [HttpPost("{id}/mark-paid")]
    public async Task<IActionResult> MarkPaid(string id, [FromBody] MarkPaidRequest request)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });
        var accepted = req.Offers.LastOrDefault(o => o.AcceptedAt != null);
        if (accepted == null || accepted.AcceptedType != TradeInOfferType.Cash)
            return BadRequest(new { error = "Not a cash trade-in" });

        req.Payout.PaidAt = DateTime.UtcNow;
        req.Payout.PaypalTransactionId = request.PaypalTransactionId;
        await _mongoDbService.UpdateTradeInRequestAsync(req);
        _ = _emailService.SendTradeInPaymentSentAsync(req.Email, req.Brand, req.Model,
            accepted.CashOffer, request.PaypalTransactionId);
        return Ok(new { id = req.Id });
    }

    [HttpPost("{id}/cancel")]
    public async Task<IActionResult> Cancel(string id)
    {
        var req = await _mongoDbService.GetTradeInRequestByIdAsync(id);
        if (req == null) return NotFound(new { error = "Not found" });
        req.Status = TradeInStatus.Cancelled;
        await _mongoDbService.UpdateTradeInRequestAsync(req);
        return Ok(new { id = req.Id });
    }
}
