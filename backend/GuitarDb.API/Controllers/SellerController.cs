using System.Collections.Concurrent;
using System.Security.Claims;
using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GuitarDb.API.Controllers;

/// <summary>
/// The whole of what a guest seller can do: connect their own Reverb account and scrape
/// their own listings onto the site. Access is the is_seller flag an admin sets on the user,
/// read from the database on every call so granting and revoking take effect immediately.
/// </summary>
[ApiController]
[Route("api/seller")]
[Authorize]
public class SellerController : ControllerBase
{
    // One scrape per seller at a time; a second click while one is running is refused.
    private static readonly ConcurrentDictionary<string, byte> RunningScrapes = new();

    private readonly MongoDbService _mongoDbService;
    private readonly ScraperService _scraperService;
    private readonly EmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<SellerController> _logger;

    public SellerController(
        MongoDbService mongoDbService,
        ScraperService scraperService,
        EmailService emailService,
        IConfiguration configuration,
        ILogger<SellerController> logger)
    {
        _mongoDbService = mongoDbService;
        _scraperService = scraperService;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
    }

    /// <summary>Connection state plus the seller's own listings on the site.</summary>
    [HttpGet]
    public async Task<IActionResult> GetOverview()
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        var listings = await _mongoDbService.GetListingsBySellerAsync(seller.Id!);

        return Ok(new
        {
            reverbConnected = ReadToken(seller) != null,
            listings = listings.Select(l => new
            {
                id = l.Id,
                listing_title = l.ListingTitle,
                condition = l.Condition,
                image = l.Images.FirstOrDefault(),
                price = l.Price,
                currency = l.Currency,
                reverb_link = l.ReverbLink,
                disabled = l.Disabled,
                scraped_at = l.ScrapedAt
            })
        });
    }

    public class ReverbTokenRequest
    {
        public string? Token { get; set; }
    }

    /// <summary>Save the seller's Reverb personal access token after checking Reverb accepts it.</summary>
    [HttpPut("reverb-token")]
    public async Task<IActionResult> SaveReverbToken([FromBody] ReverbTokenRequest request, CancellationToken ct)
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        var token = request.Token?.Trim();
        if (string.IsNullOrEmpty(token) || token.Length > 512 || token.Any(char.IsWhiteSpace))
        {
            return BadRequest(new { error = "Paste your Reverb personal access token" });
        }

        try
        {
            if (!await _scraperService.ValidateTokenAsync(token, ct))
            {
                return BadRequest(new { error = "Reverb rejected that token. Check it was copied in full and has the read_listings scope." });
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogWarning(ex, "Could not reach Reverb to validate a seller token");
            return StatusCode(502, new { error = "Couldn't reach Reverb to check the token. Try again in a minute." });
        }

        seller.ReverbApiTokenEncrypted = SecretProtector.Protect(token, MasterSecret());
        await _mongoDbService.UpdateUserAsync(seller.Id!, seller);

        _logger.LogInformation("Seller {UserId} connected a Reverb account", seller.Id);
        return Ok(new { reverbConnected = true });
    }

    /// <summary>Forget the stored token. Listings already on the site stay as they are.</summary>
    [HttpDelete("reverb-token")]
    public async Task<IActionResult> DeleteReverbToken()
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        seller.ReverbApiTokenEncrypted = null;
        await _mongoDbService.UpdateUserAsync(seller.Id!, seller);

        _logger.LogInformation("Seller {UserId} disconnected their Reverb account", seller.Id);
        return Ok(new { reverbConnected = false });
    }

    /// <summary>Scrape the seller's live Reverb listings onto the site.</summary>
    [HttpPost("run-scraper")]
    public async Task<IActionResult> RunScraper()
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        var token = ReadToken(seller);
        if (token == null)
        {
            return BadRequest(new { success = false, message = "Connect your Reverb account first" });
        }

        if (!RunningScrapes.TryAdd(seller.Id!, 0))
        {
            return Conflict(new { success = false, message = "A scrape is already running. Give it a minute." });
        }

        try
        {
            // Not tied to the request: closing the tab mid-run must not leave it half done.
            var result = await _scraperService.RunForSellerAsync(seller.Id!, token, CancellationToken.None);

            _logger.LogInformation("Seller {UserId} scrape: {Listings} listings, {Disabled} disabled",
                seller.Id, result.ListingsScraped, result.ListingsDisabled);

            return Ok(new
            {
                success = true,
                message = "Scraper completed successfully",
                listingsScraped = result.ListingsScraped,
                totalPhotos = result.TotalPhotos,
                listingsDisabled = result.ListingsDisabled,
                duration = result.Duration.ToString(@"hh\:mm\:ss"),
                output = result.OutputLines
            });
        }
        catch (HttpRequestException ex) when (ex.StatusCode is System.Net.HttpStatusCode.Unauthorized or System.Net.HttpStatusCode.Forbidden)
        {
            return BadRequest(new { success = false, message = "Reverb no longer accepts your token. Connect your Reverb account again." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Seller {UserId} scrape failed", seller.Id);
            return StatusCode(500, new { success = false, message = "The scraper failed. Try again in a minute." });
        }
        finally
        {
            RunningScrapes.TryRemove(seller.Id!, out _);
        }
    }

    // ---- Messages -------------------------------------------------------------------
    // A seller sees, and can reply in, customer conversations about their own guitars.
    // They cannot start one, and offers stay with the shop owner, whose checkout it is.

    /// <summary>Customer conversations about this seller's guitars, newest first.</summary>
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations()
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        var listings = (await _mongoDbService.GetListingsBySellerAsync(seller.Id!)).ToDictionary(l => l.Id!);
        var conversations = (await _mongoDbService.GetConversationsByListingIdsAsync(listings.Keys))
            .Where(c => c.LastMessageAt != null)
            .ToList();

        var people = (await _mongoDbService.GetUsersByIdsAsync(
            conversations.SelectMany(c => c.ParticipantIds).Distinct())).ToDictionary(u => u.Id!);

        var result = new List<object>();
        foreach (var conversation in conversations)
        {
            var listing = listings[conversation.ListingId!];
            result.Add(new
            {
                id = conversation.Id,
                customerName = CustomerOf(conversation, people)?.FullName ?? "Customer",
                listingId = listing.Id,
                listingTitle = listing.ListingTitle,
                listingImage = listing.Images.FirstOrDefault(),
                lastMessage = conversation.LastMessage,
                lastMessageAt = conversation.LastMessageAt,
                unreadCount = await _mongoDbService.CountUnreadForSellerAsync(conversation, seller.Id!)
            });
        }

        return Ok(result);
    }

    /// <summary>One conversation's messages. Opening it marks it read for the seller only.</summary>
    [HttpGet("conversations/{conversationId}")]
    public async Task<IActionResult> GetConversation(string conversationId)
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        var (conversation, listing) = await GetOwnConversationAsync(conversationId, seller);
        if (conversation == null) return NotFound(new { error = "Conversation not found" });

        var people = (await _mongoDbService.GetUsersByIdsAsync(conversation.ParticipantIds)).ToDictionary(u => u.Id!);
        var customer = CustomerOf(conversation, people);

        var messages = await _mongoDbService.GetMessagesByConversationAsync(conversationId, 200);
        messages.Reverse();

        await _mongoDbService.MarkConversationReadBySellerAsync(conversationId);

        return Ok(new
        {
            id = conversation.Id,
            customerName = customer?.FullName ?? "Customer",
            listingId = listing!.Id,
            listingTitle = listing.ListingTitle,
            listingImage = listing.Images.FirstOrDefault(),
            messages = messages.Select(m => new
            {
                id = m.Id,
                // "you", "customer", or "shop" (the owner).
                from = m.SenderId == seller.Id ? "you" : m.SenderId == customer?.Id ? "customer" : "shop",
                messageText = m.MessageText,
                imageUrls = m.ImageUrls,
                createdAt = m.CreatedAt,
                type = m.Type,
                offerAmount = m.OfferAmount
            })
        });
    }

    public class SellerReplyRequest
    {
        public string? MessageText { get; set; }
    }

    /// <summary>Reply to the customer in an existing conversation about one of the seller's guitars.</summary>
    [HttpPost("conversations/{conversationId}/messages")]
    public async Task<IActionResult> Reply(string conversationId, [FromBody] SellerReplyRequest request)
    {
        var (seller, denied) = await GetSellerAsync();
        if (seller == null) return denied!;

        var text = request.MessageText?.Trim();
        if (string.IsNullOrEmpty(text)) return BadRequest(new { error = "Message text is required" });
        if (text.Length > 5000) return BadRequest(new { error = "Message must be 5000 characters or fewer" });

        var (conversation, listing) = await GetOwnConversationAsync(conversationId, seller);
        if (conversation == null) return NotFound(new { error = "Conversation not found" });

        var people = (await _mongoDbService.GetUsersByIdsAsync(conversation.ParticipantIds)).ToDictionary(u => u.Id!);
        var customer = CustomerOf(conversation, people);
        if (customer == null || customer.Id == seller.Id)
        {
            return BadRequest(new { error = "There is no customer to reply to in this conversation" });
        }

        var message = await _mongoDbService.CreateMessageAsync(new Message
        {
            ConversationId = conversation.Id!,
            SenderId = seller.Id!,
            RecipientId = customer.Id!,
            ListingId = conversation.ListingId,
            MessageText = text
        });

        var preview = text.Length > 50 ? text.Substring(0, 47) + "..." : text;
        await _mongoDbService.UpdateConversationLastMessageAsync(conversation.Id!, preview);
        await _mongoDbService.MarkConversationReadBySellerAsync(conversation.Id!);

        // To the customer this is the shop answering, as the listing itself carries no seller name.
        if (!string.IsNullOrEmpty(customer.Email))
        {
            _ = _emailService.SendNewMessageNotificationAsync(
                customer.Email,
                _configuration["Seller:Name"] ?? "Luke's Guitar Shop",
                preview,
                listing!.ListingTitle,
                conversation.Id);
        }

        _logger.LogInformation("Seller {UserId} replied in conversation {ConversationId}", seller.Id, conversation.Id);

        return Ok(new
        {
            id = message.Id,
            from = "you",
            messageText = message.MessageText,
            imageUrls = message.ImageUrls,
            createdAt = message.CreatedAt,
            type = message.Type,
            offerAmount = message.OfferAmount
        });
    }

    /// <summary>The conversation, only if it is about one of this seller's guitars.</summary>
    private async Task<(Conversation? Conversation, MyListing? Listing)> GetOwnConversationAsync(string conversationId, User seller)
    {
        if (!MongoDB.Bson.ObjectId.TryParse(conversationId, out _)) return (null, null);

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation?.ListingId == null) return (null, null);

        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        return listing != null && listing.SellerId == seller.Id ? (conversation, listing) : (null, null);
    }

    /// <summary>The participant who is not the shop owner.</summary>
    private static User? CustomerOf(Conversation conversation, Dictionary<string, User> people) =>
        conversation.ParticipantIds
            .Select(id => people.GetValueOrDefault(id))
            .FirstOrDefault(u => u != null && !u.IsAdmin);

    private async Task<(User? Seller, IActionResult? Denied)> GetSellerAsync()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var user = string.IsNullOrEmpty(userId) ? null : await _mongoDbService.GetUserByIdAsync(userId);

        if (user == null)
        {
            return (null, Unauthorized(new { error = "Authentication required" }));
        }

        if (!user.IsSeller || user.IsGuest)
        {
            return (null, StatusCode(StatusCodes.Status403Forbidden, new { error = "Seller access required" }));
        }

        return (user, null);
    }

    private string? ReadToken(User seller) =>
        SecretProtector.Unprotect(seller.ReverbApiTokenEncrypted, MasterSecret());

    private string MasterSecret() =>
        _configuration["Jwt:SecretKey"]
            ?? throw new InvalidOperationException("JWT secret key is not configured");
}
