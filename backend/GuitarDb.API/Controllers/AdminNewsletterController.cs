using GuitarDb.API.Attributes;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

/// <summary>
/// Admin view of the newsletter. For now this is the preview only: what the next issue
/// would look like if it were built from the shop's data this minute. Nothing is sent
/// and no discount code is created.
/// </summary>
[ApiController]
[Route("api/admin/newsletter")]
[AdminAuthorize]
public class AdminNewsletterController : ControllerBase
{
    public const string MissingAddress = "[Mailing address needed before the first send]";

    private readonly MongoDbService _mongoDbService;
    private readonly IConfiguration _configuration;

    public AdminNewsletterController(MongoDbService mongoDbService, IConfiguration configuration)
    {
        _mongoDbService = mongoDbService;
        _configuration = configuration;
    }

    /// <param name="format">"html" (default) or "text" for the plain-text version.</param>
    [HttpGet("preview")]
    public async Task<IActionResult> Preview([FromQuery] string format = "html")
    {
        var listings = await _mongoDbService.GetAllMyListingsAsync();

        // A guitar on hold or promised to someone is not for sale, so it is not shown as such.
        var reservations = await _mongoDbService.GetActiveReservationsByListingIdsAsync(
            listings.Select(l => l.Id!));
        var available = listings
            .Where(l => !l.Pending && !reservations.ContainsKey(l.Id!))
            .ToList();

        var sold = await _mongoDbService.GetRecentSoldListingsAsync(NewsletterTemplate.MaxRecentlySold);

        // A stand-in for the code the real job will create: same shape, never saved.
        var now = DateTime.UtcNow;
        var sampleCode = new DiscountCode
        {
            Code = $"STRUM-{now:MMdd}",
            PercentOff = 5m,
            StartsAt = now,
            ExpiresAt = now.AddDays(14),
            Source = DiscountCodeSource.Newsletter
        };

        var content = NewsletterTemplate.BuildContent(available, sold, sampleCode);
        var branding = new NewsletterBranding(
            _configuration["FrontendUrl"] ?? "https://lukesguitarshop.com",
            _configuration["Seller:Name"] ?? "Luke's Guitar Shop",
            _configuration["Newsletter:MailingAddress"] is { Length: > 0 } address ? address : MissingAddress);

        Response.Headers["X-Newsletter-Subject"] = Uri.EscapeDataString(NewsletterTemplate.Subject(content));
        Response.Headers["X-Newsletter-Would-Send"] = NewsletterTemplate.ShouldSend(content) ? "true" : "false";

        return string.Equals(format, "text", StringComparison.OrdinalIgnoreCase)
            ? Content(NewsletterTemplate.RenderText(content, branding), "text/plain; charset=utf-8")
            : Content(NewsletterTemplate.RenderHtml(content, branding), "text/html; charset=utf-8");
    }
}
