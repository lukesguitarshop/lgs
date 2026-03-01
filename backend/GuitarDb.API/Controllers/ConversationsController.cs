using GuitarDb.API.Models;
using GuitarDb.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace GuitarDb.API.Controllers;

[ApiController]
[Route("api/conversations")]
[Authorize]
public class ConversationsController : ControllerBase
{
    private readonly MongoDbService _mongoDbService;
    private readonly EmailService _emailService;
    private readonly ILogger<ConversationsController> _logger;

    // Default offer expiration: 48 hours
    private static readonly TimeSpan OfferExpiration = TimeSpan.FromHours(48);

    public ConversationsController(
        MongoDbService mongoDbService,
        EmailService emailService,
        ILogger<ConversationsController> logger)
    {
        _mongoDbService = mongoDbService;
        _emailService = emailService;
        _logger = logger;
    }

    /// <summary>
    /// Start a new conversation with an initial offer (buyer)
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> StartConversation([FromBody] StartOfferConversationRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (request.OfferAmount <= 0)
        {
            return BadRequest(new { error = "Offer amount must be positive" });
        }

        if (request.OfferAmount > 99999)
        {
            return BadRequest(new { error = "Offer amount cannot exceed $99,999" });
        }

        var listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        if (listing.Disabled)
        {
            return BadRequest(new { error = "This listing is no longer available" });
        }

        // Get the admin (seller) for this single-seller shop
        var seller = await _mongoDbService.GetAdminUserAsync();
        if (seller == null)
        {
            return StatusCode(500, new { error = "Shop configuration error - no seller found" });
        }

        // Prevent admin from making offers on their own listings
        if (seller.Id == userId)
        {
            return BadRequest(new { error = "Cannot make an offer on your own listing" });
        }

        // Check if buyer already has an active conversation on this listing
        var existingConversation = await _mongoDbService.GetOfferConversationByBuyerAndListingAsync(userId, request.ListingId);
        if (existingConversation != null && existingConversation.Status == ConversationStatus.Active)
        {
            return BadRequest(new { error = "You already have an active conversation on this listing" });
        }

        var conversation = new OfferConversation
        {
            ListingId = request.ListingId,
            BuyerId = userId,
            SellerId = seller.Id!,
            PendingActionBy = ActionBy.Seller,
            PendingOfferAmount = request.OfferAmount,
            PendingExpiresAt = DateTime.UtcNow.Add(OfferExpiration),
            Status = ConversationStatus.Active
        };

        // Add initial offer event
        conversation.Events.Add(new ConversationEvent
        {
            Type = ConversationEventType.Offer,
            SenderId = userId,
            OfferAmount = request.OfferAmount,
            CreatedAt = DateTime.UtcNow
        });

        // Add message if provided
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            conversation.Events.Add(new ConversationEvent
            {
                Type = ConversationEventType.Message,
                SenderId = userId,
                MessageText = request.Message,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _mongoDbService.CreateOfferConversationAsync(conversation);

        // Send email notification to seller
        var buyer = await _mongoDbService.GetUserByIdAsync(userId);
        _ = _emailService.SendNewOfferNotificationAsync(
            listing.ListingTitle,
            request.OfferAmount,
            buyer?.FullName ?? "Unknown Buyer",
            request.Message);

        _logger.LogInformation("New conversation started: {ConversationId} for listing {ListingId}", conversation.Id, request.ListingId);

        return Ok(await MapToOfferConversationDto(conversation));
    }

    /// <summary>
    /// Get all conversations for current user
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyConversations([FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversations = await _mongoDbService.GetOfferConversationsByUserAsync(userId);

        if (!string.IsNullOrEmpty(status))
        {
            conversations = conversations.Where(c => c.Status == status).ToList();
        }

        var result = new List<OfferConversationDto>();
        foreach (var conversation in conversations)
        {
            result.Add(await MapToOfferConversationDto(conversation, userId));
        }

        return Ok(result);
    }

    /// <summary>
    /// Get conversations for a specific listing (admin/seller view)
    /// </summary>
    [HttpGet("listing/{listingId}")]
    public async Task<IActionResult> GetConversationsForListing(string listingId, [FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        // Only admin (seller) can view all conversations for a listing
        var seller = await _mongoDbService.GetAdminUserAsync();
        if (seller?.Id != userId)
        {
            return Forbid();
        }

        var conversations = await _mongoDbService.GetOfferConversationsByListingAsync(listingId);

        if (!string.IsNullOrEmpty(status))
        {
            conversations = conversations.Where(c => c.Status == status).ToList();
        }

        var result = new List<OfferConversationDto>();
        foreach (var conversation in conversations)
        {
            result.Add(await MapToOfferConversationDto(conversation, userId));
        }

        return Ok(result);
    }

    /// <summary>
    /// Get conversation details
    /// </summary>
    [HttpGet("{conversationId}")]
    public async Task<IActionResult> GetConversation(string conversationId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: only buyer or seller can view
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        return Ok(await MapToOfferConversationDto(conversation, userId));
    }

    /// <summary>
    /// Make an offer or counter-offer in the conversation
    /// </summary>
    [HttpPost("{conversationId}/offer")]
    public async Task<IActionResult> MakeOffer(string conversationId, [FromBody] MakeOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (request.OfferAmount <= 0)
        {
            return BadRequest(new { error = "Offer amount must be positive" });
        }

        if (request.OfferAmount > 99999)
        {
            return BadRequest(new { error = "Offer amount cannot exceed $99,999" });
        }

        var conversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: only buyer or seller can make offers
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        if (conversation.Status != ConversationStatus.Active)
        {
            return BadRequest(new { error = "This conversation is no longer active" });
        }

        // Determine whose turn it is
        var isBuyer = conversation.BuyerId == userId;
        var expectedActionBy = isBuyer ? ActionBy.Buyer : ActionBy.Seller;

        if (conversation.PendingActionBy != expectedActionBy && conversation.PendingActionBy != null)
        {
            return BadRequest(new { error = "It's not your turn to make an offer" });
        }

        // Add offer event
        await _mongoDbService.AddOfferConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Offer,
            SenderId = userId,
            OfferAmount = request.OfferAmount,
            CreatedAt = DateTime.UtcNow
        });

        // Add message if provided
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            await _mongoDbService.AddOfferConversationEventAsync(conversationId, new ConversationEvent
            {
                Type = ConversationEventType.Message,
                SenderId = userId,
                MessageText = request.Message,
                CreatedAt = DateTime.UtcNow
            });
        }

        // Update pending offer - ball is now in other party's court
        var newPendingActionBy = isBuyer ? ActionBy.Seller : ActionBy.Buyer;
        await _mongoDbService.UpdateOfferConversationOfferAsync(
            conversationId,
            newPendingActionBy,
            request.OfferAmount,
            DateTime.UtcNow.Add(OfferExpiration));

        _logger.LogInformation("Offer made in conversation {ConversationId}: {Amount} by {UserId}",
            conversationId, request.OfferAmount, userId);

        // Send email notification
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        if (isBuyer)
        {
            // Buyer made offer - notify seller
            var buyer = await _mongoDbService.GetUserByIdAsync(userId);
            _ = _emailService.SendNewOfferNotificationAsync(
                listing?.ListingTitle ?? "Unknown Listing",
                request.OfferAmount,
                buyer?.FullName ?? "Unknown Buyer",
                request.Message);
        }
        else
        {
            // Seller made counter - notify buyer
            var buyer = await _mongoDbService.GetUserByIdAsync(conversation.BuyerId);
            if (buyer?.Email != null && listing != null)
            {
                _ = _emailService.SendCounterOfferNotificationAsync(
                    buyer.Email,
                    listing.ListingTitle,
                    conversation.PendingOfferAmount ?? 0,
                    request.OfferAmount,
                    request.Message);
            }
        }

        var updatedConversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        return Ok(await MapToOfferConversationDto(updatedConversation!, userId));
    }

    /// <summary>
    /// Send a message in the conversation (no offer change)
    /// </summary>
    [HttpPost("{conversationId}/message")]
    public async Task<IActionResult> SendMessage(string conversationId, [FromBody] OfferConversationMessageRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "Message cannot be empty" });
        }

        var conversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: only buyer or seller can send messages
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        if (conversation.Status != ConversationStatus.Active)
        {
            return BadRequest(new { error = "This conversation is no longer active" });
        }

        await _mongoDbService.AddOfferConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Message,
            SenderId = userId,
            MessageText = request.Message,
            CreatedAt = DateTime.UtcNow
        });

        _logger.LogInformation("Message sent in conversation {ConversationId} by {UserId}", conversationId, userId);

        // Send email notification to the other party
        var isBuyer = conversation.BuyerId == userId;
        var recipientId = isBuyer ? conversation.SellerId : conversation.BuyerId;
        var sender = await _mongoDbService.GetUserByIdAsync(userId);
        var recipient = await _mongoDbService.GetUserByIdAsync(recipientId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        if (recipient?.Email != null)
        {
            _ = _emailService.SendNewMessageNotificationAsync(
                recipient.Email,
                sender?.FullName ?? "Unknown User",
                request.Message.Length > 100 ? request.Message.Substring(0, 100) + "..." : request.Message,
                listing?.ListingTitle,
                conversationId);
        }

        var updatedConversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        return Ok(await MapToOfferConversationDto(updatedConversation!, userId));
    }

    /// <summary>
    /// Accept the current pending offer
    /// </summary>
    [HttpPost("{conversationId}/accept")]
    public async Task<IActionResult> AcceptOffer(string conversationId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: only buyer or seller can accept
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        if (conversation.Status != ConversationStatus.Active)
        {
            return BadRequest(new { error = "This conversation is no longer active" });
        }

        if (conversation.PendingOfferAmount == null)
        {
            return BadRequest(new { error = "No pending offer to accept" });
        }

        // Check that this user is the one who should accept (not the one who made the offer)
        var isBuyer = conversation.BuyerId == userId;
        var expectedActionBy = isBuyer ? ActionBy.Buyer : ActionBy.Seller;

        if (conversation.PendingActionBy != expectedActionBy)
        {
            return BadRequest(new { error = "You cannot accept your own offer" });
        }

        var acceptedAmount = conversation.PendingOfferAmount.Value;

        // Add accept event
        await _mongoDbService.AddOfferConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Accept,
            SenderId = userId,
            OfferAmount = acceptedAmount,
            CreatedAt = DateTime.UtcNow
        });

        // Update conversation status
        await _mongoDbService.AcceptOfferConversationOfferAsync(conversationId, acceptedAmount);

        _logger.LogInformation("Offer accepted in conversation {ConversationId}: {Amount} by {UserId}",
            conversationId, acceptedAmount, userId);

        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(conversation.BuyerId);

        // Disable listing and create pending cart item
        if (listing != null)
        {
            await _mongoDbService.SetListingDisabledAsync(conversation.ListingId, true);

            var pendingCartItem = new PendingCartItem
            {
                UserId = conversation.BuyerId,
                ListingId = conversation.ListingId,
                OfferId = conversationId, // Use conversation ID as the offer reference
                Price = acceptedAmount,
                Currency = listing.Currency,
                ListingTitle = listing.ListingTitle,
                ListingImage = listing.Images?.FirstOrDefault() ?? "",
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(72)
            };
            await _mongoDbService.CreatePendingCartItemAsync(pendingCartItem);
            _logger.LogInformation("Created pending cart item for buyer {BuyerId} on listing {ListingId}",
                conversation.BuyerId, conversation.ListingId);

            // Auto-decline other conversations on this listing
            var declinedConversations = await _mongoDbService.DeclineOtherOfferConversationsOnListingAsync(
                conversation.ListingId, conversationId);
            _logger.LogInformation("Auto-declined {Count} other conversations on listing {ListingId}",
                declinedConversations.Count, conversation.ListingId);

            // Send rejection emails to other buyers
            foreach (var declinedConv in declinedConversations)
            {
                var declinedBuyer = await _mongoDbService.GetUserByIdAsync(declinedConv.BuyerId);
                if (declinedBuyer?.Email != null)
                {
                    _ = _emailService.SendOfferRejectedNotificationAsync(
                        declinedBuyer.Email,
                        listing.ListingTitle,
                        declinedConv.PendingOfferAmount ?? 0,
                        "Another offer was accepted for this item.");
                }
            }
        }

        // Send email notifications
        if (listing != null && buyer?.Email != null)
        {
            // Notify buyer
            _ = _emailService.SendOfferAcceptedNotificationAsync(
                buyer.Email,
                listing.ListingTitle,
                acceptedAmount,
                isBuyer: true);
        }

        // If buyer accepted (seller's offer), notify seller
        if (isBuyer && listing != null)
        {
            _ = _emailService.SendOfferAcceptedToSellerAsync(
                listing.ListingTitle,
                acceptedAmount,
                buyer?.FullName ?? "Unknown Buyer");
        }
        // If seller accepted (buyer's offer), notify seller too
        else if (!isBuyer && listing != null)
        {
            _ = _emailService.SendOfferAcceptedNotificationAsync(
                "", // Will be skipped since we need seller email
                listing.ListingTitle,
                acceptedAmount,
                isBuyer: false);
        }

        var updatedConversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        return Ok(await MapToOfferConversationDto(updatedConversation!, userId));
    }

    /// <summary>
    /// Decline the conversation
    /// </summary>
    [HttpPost("{conversationId}/decline")]
    public async Task<IActionResult> DeclineConversation(string conversationId, [FromBody] DeclineOfferRequest? request = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: only buyer or seller can decline
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        if (conversation.Status != ConversationStatus.Active)
        {
            return BadRequest(new { error = "This conversation is no longer active" });
        }

        // Add decline event
        await _mongoDbService.AddOfferConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Decline,
            SenderId = userId,
            MessageText = request?.Reason,
            CreatedAt = DateTime.UtcNow
        });

        await _mongoDbService.DeclineOfferConversationAsync(conversationId);

        _logger.LogInformation("Conversation declined: {ConversationId} by {UserId}", conversationId, userId);

        // Send email notification to the other party
        var isBuyer = conversation.BuyerId == userId;
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        if (!isBuyer && listing != null)
        {
            // Seller declined - notify buyer
            var buyer = await _mongoDbService.GetUserByIdAsync(conversation.BuyerId);
            if (buyer?.Email != null)
            {
                _ = _emailService.SendOfferRejectedNotificationAsync(
                    buyer.Email,
                    listing.ListingTitle,
                    conversation.PendingOfferAmount ?? 0,
                    request?.Reason);
            }
        }

        var updatedConversation = await _mongoDbService.GetOfferConversationByIdAsync(conversationId);
        return Ok(await MapToOfferConversationDto(updatedConversation!, userId));
    }

    /// <summary>
    /// Admin endpoint: Get all conversations
    /// </summary>
    [HttpGet("admin/all")]
    [Authorize(Roles = "admin")]
    public async Task<IActionResult> GetAllConversations([FromQuery] string? status = null)
    {
        var conversations = await _mongoDbService.GetAllOfferConversationsAsync(status);

        var result = new List<OfferConversationDto>();
        foreach (var conversation in conversations)
        {
            result.Add(await MapToOfferConversationDto(conversation));
        }

        return Ok(result);
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    private async Task<OfferConversationDto> MapToOfferConversationDto(OfferConversation conversation, string? currentUserId = null)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(conversation.BuyerId);
        var seller = await _mongoDbService.GetUserByIdAsync(conversation.SellerId);

        var isBuyer = currentUserId == conversation.BuyerId;
        var isSeller = currentUserId == conversation.SellerId;

        return new OfferConversationDto
        {
            Id = conversation.Id!,
            ListingId = conversation.ListingId,
            BuyerId = conversation.BuyerId,
            SellerId = conversation.SellerId,
            BuyerName = buyer?.FullName ?? "Unknown",
            SellerName = seller?.FullName ?? "Unknown",
            PendingActionBy = conversation.PendingActionBy,
            PendingOfferAmount = conversation.PendingOfferAmount,
            PendingExpiresAt = conversation.PendingExpiresAt,
            Status = conversation.Status,
            AcceptedAmount = conversation.AcceptedAmount,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt,
            IsMyTurn = (isBuyer && conversation.PendingActionBy == ActionBy.Buyer) ||
                       (isSeller && conversation.PendingActionBy == ActionBy.Seller),
            Events = conversation.Events.Select(e => new OfferConversationEventDto
            {
                Type = e.Type,
                SenderId = e.SenderId,
                MessageText = e.MessageText,
                OfferAmount = e.OfferAmount,
                CreatedAt = e.CreatedAt
            }).ToList(),
            Listing = listing != null ? new ListingSummaryDto
            {
                Id = listing.Id!,
                ListingTitle = listing.ListingTitle,
                Price = listing.Price,
                Currency = listing.Currency,
                Condition = listing.Condition,
                Image = listing.Images?.FirstOrDefault(),
                Disabled = listing.Disabled
            } : null
        };
    }
}

// Request DTOs
public class StartOfferConversationRequest
{
    public string ListingId { get; set; } = string.Empty;
    public decimal OfferAmount { get; set; }
    public string? Message { get; set; }
}

public class MakeOfferRequest
{
    public decimal OfferAmount { get; set; }
    public string? Message { get; set; }
}

public class OfferConversationMessageRequest
{
    public string Message { get; set; } = string.Empty;
}

public class DeclineOfferRequest
{
    public string? Reason { get; set; }
}

// Response DTOs
public class OfferConversationDto
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string BuyerId { get; set; } = string.Empty;
    public string SellerId { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public string SellerName { get; set; } = string.Empty;
    public string? PendingActionBy { get; set; }
    public decimal? PendingOfferAmount { get; set; }
    public DateTime? PendingExpiresAt { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? AcceptedAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public bool IsMyTurn { get; set; }
    public List<OfferConversationEventDto> Events { get; set; } = new();
    public ListingSummaryDto? Listing { get; set; }
}

public class OfferConversationEventDto
{
    public string Type { get; set; } = string.Empty;
    public string? SenderId { get; set; }
    public string? MessageText { get; set; }
    public decimal? OfferAmount { get; set; }
    public DateTime CreatedAt { get; set; }
}
