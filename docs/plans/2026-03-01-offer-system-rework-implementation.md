# Offer System Rework Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the buggy offer system with a chat-like conversation model featuring turn-based negotiation and 48-hour offer expiration.

**Architecture:** Refactor existing `Offer` model into `OfferConversation` with typed `ConversationEvent` array. New `ConversationsController` with proper authorization. Frontend gets chat-style UI at `/conversations`.

**Tech Stack:** C# ASP.NET Core backend, MongoDB, Next.js frontend with TypeScript, Tailwind CSS

---

## Task 1: Create OfferConversation Model

**Files:**
- Create: `backend/GuitarDb.API/Models/OfferConversation.cs`

**Step 1: Create the model file**

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class OfferConversation
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("listing_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string ListingId { get; set; } = string.Empty;

    [BsonElement("buyer_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string BuyerId { get; set; } = string.Empty;

    [BsonElement("seller_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string SellerId { get; set; } = string.Empty;

    [BsonElement("pending_action_by")]
    [BsonIgnoreIfNull]
    public string? PendingActionBy { get; set; } // "buyer" | "seller" | null

    [BsonElement("pending_offer_amount")]
    [BsonIgnoreIfNull]
    public decimal? PendingOfferAmount { get; set; }

    [BsonElement("pending_expires_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? PendingExpiresAt { get; set; }

    [BsonElement("status")]
    public string Status { get; set; } = ConversationStatus.Active;

    [BsonElement("accepted_amount")]
    [BsonIgnoreIfNull]
    public decimal? AcceptedAmount { get; set; }

    [BsonElement("events")]
    public List<ConversationEvent> Events { get; set; } = new();

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class ConversationEvent
{
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty; // "message" | "offer" | "accept" | "decline" | "expire"

    [BsonElement("sender_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? SenderId { get; set; }

    [BsonElement("message_text")]
    [BsonIgnoreIfNull]
    public string? MessageText { get; set; }

    [BsonElement("offer_amount")]
    [BsonIgnoreIfNull]
    public decimal? OfferAmount { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class ConversationStatus
{
    public const string Active = "active";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
    public const string Expired = "expired";
}

public static class ConversationEventType
{
    public const string Message = "message";
    public const string Offer = "offer";
    public const string Accept = "accept";
    public const string Decline = "decline";
    public const string Expire = "expire";
}

public static class ActionBy
{
    public const string Buyer = "buyer";
    public const string Seller = "seller";
}
```

**Step 2: Verify file compiles**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/OfferConversation.cs
git commit -m "feat: add OfferConversation model for chat-like offers"
```

---

## Task 2: Add MongoDbService Methods for Conversations

**Files:**
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs`

**Step 1: Add collection property and methods**

Add after the existing `_offersCollection` declaration:

```csharp
private readonly IMongoCollection<OfferConversation> _conversationsCollection;
```

Add in constructor after `_offersCollection` initialization:

```csharp
_conversationsCollection = database.GetCollection<OfferConversation>("conversations");
```

Add these methods:

```csharp
// ============ CONVERSATIONS ============

public async Task<OfferConversation> CreateConversationAsync(OfferConversation conversation)
{
    await _conversationsCollection.InsertOneAsync(conversation);
    return conversation;
}

public async Task<OfferConversation?> GetConversationByIdAsync(string conversationId)
{
    return await _conversationsCollection.Find(c => c.Id == conversationId).FirstOrDefaultAsync();
}

public async Task<OfferConversation?> GetConversationByBuyerAndListingAsync(string buyerId, string listingId)
{
    return await _conversationsCollection
        .Find(c => c.BuyerId == buyerId && c.ListingId == listingId)
        .FirstOrDefaultAsync();
}

public async Task<List<OfferConversation>> GetConversationsByUserAsync(string userId)
{
    var filter = Builders<OfferConversation>.Filter.Or(
        Builders<OfferConversation>.Filter.Eq(c => c.BuyerId, userId),
        Builders<OfferConversation>.Filter.Eq(c => c.SellerId, userId)
    );
    return await _conversationsCollection.Find(filter)
        .SortByDescending(c => c.UpdatedAt)
        .ToListAsync();
}

public async Task<List<OfferConversation>> GetConversationsByListingAsync(string listingId)
{
    return await _conversationsCollection
        .Find(c => c.ListingId == listingId)
        .SortByDescending(c => c.UpdatedAt)
        .ToListAsync();
}

public async Task<List<OfferConversation>> GetAllConversationsAsync(string? status = null)
{
    var filter = string.IsNullOrEmpty(status)
        ? Builders<OfferConversation>.Filter.Empty
        : Builders<OfferConversation>.Filter.Eq(c => c.Status, status);
    return await _conversationsCollection.Find(filter)
        .SortByDescending(c => c.UpdatedAt)
        .ToListAsync();
}

public async Task AddConversationEventAsync(string conversationId, ConversationEvent evt)
{
    var update = Builders<OfferConversation>.Update
        .Push(c => c.Events, evt)
        .Set(c => c.UpdatedAt, DateTime.UtcNow);
    await _conversationsCollection.UpdateOneAsync(c => c.Id == conversationId, update);
}

public async Task UpdateConversationOfferAsync(
    string conversationId,
    string pendingActionBy,
    decimal offerAmount,
    DateTime expiresAt)
{
    var update = Builders<OfferConversation>.Update
        .Set(c => c.PendingActionBy, pendingActionBy)
        .Set(c => c.PendingOfferAmount, offerAmount)
        .Set(c => c.PendingExpiresAt, expiresAt)
        .Set(c => c.UpdatedAt, DateTime.UtcNow);
    await _conversationsCollection.UpdateOneAsync(c => c.Id == conversationId, update);
}

public async Task AcceptConversationOfferAsync(string conversationId, decimal acceptedAmount)
{
    var update = Builders<OfferConversation>.Update
        .Set(c => c.Status, ConversationStatus.Accepted)
        .Set(c => c.AcceptedAmount, acceptedAmount)
        .Set(c => c.PendingActionBy, null)
        .Set(c => c.PendingOfferAmount, null)
        .Set(c => c.PendingExpiresAt, null)
        .Set(c => c.UpdatedAt, DateTime.UtcNow);
    await _conversationsCollection.UpdateOneAsync(c => c.Id == conversationId, update);
}

public async Task DeclineConversationAsync(string conversationId)
{
    var update = Builders<OfferConversation>.Update
        .Set(c => c.Status, ConversationStatus.Declined)
        .Set(c => c.PendingActionBy, null)
        .Set(c => c.PendingOfferAmount, null)
        .Set(c => c.PendingExpiresAt, null)
        .Set(c => c.UpdatedAt, DateTime.UtcNow);
    await _conversationsCollection.UpdateOneAsync(c => c.Id == conversationId, update);
}

public async Task<List<OfferConversation>> GetExpiredConversationsAsync()
{
    var filter = Builders<OfferConversation>.Filter.And(
        Builders<OfferConversation>.Filter.Eq(c => c.Status, ConversationStatus.Active),
        Builders<OfferConversation>.Filter.Lt(c => c.PendingExpiresAt, DateTime.UtcNow),
        Builders<OfferConversation>.Filter.Ne(c => c.PendingExpiresAt, null)
    );
    return await _conversationsCollection.Find(filter).ToListAsync();
}

public async Task ExpireConversationAsync(string conversationId)
{
    var update = Builders<OfferConversation>.Update
        .Set(c => c.Status, ConversationStatus.Expired)
        .Set(c => c.PendingActionBy, null)
        .Set(c => c.PendingOfferAmount, null)
        .Set(c => c.PendingExpiresAt, null)
        .Set(c => c.UpdatedAt, DateTime.UtcNow);
    await _conversationsCollection.UpdateOneAsync(c => c.Id == conversationId, update);
}

public async Task<List<OfferConversation>> DeclineOtherConversationsOnListingAsync(string listingId, string exceptConversationId)
{
    var filter = Builders<OfferConversation>.Filter.And(
        Builders<OfferConversation>.Filter.Eq(c => c.ListingId, listingId),
        Builders<OfferConversation>.Filter.Eq(c => c.Status, ConversationStatus.Active),
        Builders<OfferConversation>.Filter.Ne(c => c.Id, exceptConversationId)
    );

    var conversations = await _conversationsCollection.Find(filter).ToListAsync();

    foreach (var conv in conversations)
    {
        await DeclineConversationAsync(conv.Id!);
        await AddConversationEventAsync(conv.Id!, new ConversationEvent
        {
            Type = ConversationEventType.Decline,
            MessageText = "Another offer was accepted for this item.",
            CreatedAt = DateTime.UtcNow
        });
    }

    return conversations;
}
```

**Step 2: Verify build succeeds**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/MongoDbService.cs
git commit -m "feat: add MongoDbService methods for conversations"
```

---

## Task 3: Create ConversationsController

**Files:**
- Create: `backend/GuitarDb.API/Controllers/ConversationsController.cs`

**Step 1: Create the controller**

```csharp
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
    private const int OFFER_EXPIRY_HOURS = 48;

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
    /// Get all conversations for current user (as buyer or seller)
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMyConversations([FromQuery] string? status = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversations = await _mongoDbService.GetConversationsByUserAsync(userId);

        if (!string.IsNullOrEmpty(status))
        {
            conversations = conversations.Where(c => c.Status == status).ToList();
        }

        var result = new List<ConversationDto>();
        foreach (var conv in conversations)
        {
            result.Add(await MapToConversationDto(conv, userId));
        }

        return Ok(result);
    }

    /// <summary>
    /// Get conversation by ID
    /// </summary>
    [HttpGet("{conversationId}")]
    public async Task<IActionResult> GetConversation(string conversationId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization: only buyer or seller can view
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        return Ok(await MapToConversationDto(conversation, userId));
    }

    /// <summary>
    /// Start a new conversation or get existing one
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> StartConversation([FromBody] StartConversationRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var listing = await _mongoDbService.GetMyListingByIdAsync(request.ListingId);
        if (listing == null)
        {
            return NotFound(new { error = "Listing not found" });
        }

        if (listing.Disabled)
        {
            return BadRequest(new { error = "This listing is no longer available" });
        }

        // Get seller ID from listing
        var sellerId = listing.UserId;
        if (string.IsNullOrEmpty(sellerId))
        {
            return BadRequest(new { error = "Listing has no seller" });
        }

        // Check if user is buyer or seller
        bool isBuyer = userId != sellerId;
        string buyerId = isBuyer ? userId : request.BuyerId ?? "";

        if (!isBuyer && string.IsNullOrEmpty(request.BuyerId))
        {
            return BadRequest(new { error = "Seller must specify buyer ID" });
        }

        // Check for existing conversation
        var existing = await _mongoDbService.GetConversationByBuyerAndListingAsync(buyerId, request.ListingId);
        if (existing != null)
        {
            return Ok(await MapToConversationDto(existing, userId));
        }

        var conversation = new OfferConversation
        {
            ListingId = request.ListingId,
            BuyerId = buyerId,
            SellerId = sellerId
        };

        await _mongoDbService.CreateConversationAsync(conversation);

        // If initial offer provided, make it
        if (request.InitialOfferAmount.HasValue)
        {
            return await MakeOfferInternal(conversation.Id!, request.InitialOfferAmount.Value, request.Message, userId);
        }

        // If just a message, add it
        if (!string.IsNullOrWhiteSpace(request.Message))
        {
            await _mongoDbService.AddConversationEventAsync(conversation.Id!, new ConversationEvent
            {
                Type = ConversationEventType.Message,
                SenderId = userId,
                MessageText = request.Message
            });
        }

        var updated = await _mongoDbService.GetConversationByIdAsync(conversation.Id!);
        return Ok(await MapToConversationDto(updated!, userId));
    }

    /// <summary>
    /// Make or counter an offer (sets 48hr expiry)
    /// </summary>
    [HttpPost("{conversationId}/offer")]
    public async Task<IActionResult> MakeOffer(string conversationId, [FromBody] MakeOfferRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        return await MakeOfferInternal(conversationId, request.Amount, request.Message, userId);
    }

    private async Task<IActionResult> MakeOfferInternal(string conversationId, decimal amount, string? message, string userId)
    {
        if (amount <= 0)
        {
            return BadRequest(new { error = "Offer amount must be positive" });
        }

        if (amount > 99999)
        {
            return BadRequest(new { error = "Offer amount cannot exceed $99,999" });
        }

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
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

        // Determine who should respond
        bool isBuyer = conversation.BuyerId == userId;
        string pendingActionBy = isBuyer ? ActionBy.Seller : ActionBy.Buyer;

        // Check turn - if there's a pending offer, only the other party can respond
        if (conversation.PendingActionBy != null)
        {
            string myRole = isBuyer ? ActionBy.Buyer : ActionBy.Seller;
            if (conversation.PendingActionBy != myRole)
            {
                return BadRequest(new { error = "It's not your turn to make an offer. Wait for the other party to respond." });
            }
        }

        var expiresAt = DateTime.UtcNow.AddHours(OFFER_EXPIRY_HOURS);

        // Add offer event
        await _mongoDbService.AddConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Offer,
            SenderId = userId,
            OfferAmount = amount
        });

        // Add message if provided
        if (!string.IsNullOrWhiteSpace(message))
        {
            await _mongoDbService.AddConversationEventAsync(conversationId, new ConversationEvent
            {
                Type = ConversationEventType.Message,
                SenderId = userId,
                MessageText = message
            });
        }

        // Update conversation state
        await _mongoDbService.UpdateConversationOfferAsync(conversationId, pendingActionBy, amount, expiresAt);

        _logger.LogInformation("Offer made on conversation {ConversationId}: {Amount} by {UserId}", conversationId, amount, userId);

        // Send email notification to other party
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        var otherUserId = isBuyer ? conversation.SellerId : conversation.BuyerId;
        var otherUser = await _mongoDbService.GetUserByIdAsync(otherUserId);

        if (otherUser?.Email != null && listing != null)
        {
            bool isCounter = conversation.Events.Any(e => e.Type == ConversationEventType.Offer);
            await _emailService.SendOfferNotificationAsync(
                otherUser.Email,
                listing.ListingTitle,
                amount,
                conversationId,
                isCounter);
        }

        var updated = await _mongoDbService.GetConversationByIdAsync(conversationId);
        return Ok(await MapToConversationDto(updated!, userId));
    }

    /// <summary>
    /// Accept the pending offer
    /// </summary>
    [HttpPost("{conversationId}/accept")]
    public async Task<IActionResult> AcceptOffer(string conversationId)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization
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

        // Check it's your turn
        bool isBuyer = conversation.BuyerId == userId;
        string myRole = isBuyer ? ActionBy.Buyer : ActionBy.Seller;
        if (conversation.PendingActionBy != myRole)
        {
            return BadRequest(new { error = "It's not your turn to respond" });
        }

        var acceptedAmount = conversation.PendingOfferAmount.Value;

        // Add accept event
        await _mongoDbService.AddConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Accept,
            SenderId = userId,
            OfferAmount = acceptedAmount
        });

        // Update conversation
        await _mongoDbService.AcceptConversationOfferAsync(conversationId, acceptedAmount);

        _logger.LogInformation("Offer accepted on conversation {ConversationId}: {Amount}", conversationId, acceptedAmount);

        // Disable listing and create pending cart item
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        if (listing != null)
        {
            await _mongoDbService.SetListingDisabledAsync(conversation.ListingId, true);

            var pendingCartItem = new PendingCartItem
            {
                UserId = conversation.BuyerId,
                ListingId = conversation.ListingId,
                OfferId = conversationId,
                Price = acceptedAmount,
                Currency = listing.Currency,
                ListingTitle = listing.ListingTitle,
                ListingImage = listing.Images?.FirstOrDefault() ?? "",
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddHours(72)
            };
            await _mongoDbService.CreatePendingCartItemAsync(pendingCartItem);

            // Auto-decline other conversations
            var declinedConversations = await _mongoDbService.DeclineOtherConversationsOnListingAsync(conversation.ListingId, conversationId);

            // Send decline emails to other buyers
            foreach (var declined in declinedConversations)
            {
                var buyer = await _mongoDbService.GetUserByIdAsync(declined.BuyerId);
                if (buyer?.Email != null)
                {
                    await _emailService.SendOfferDeclinedNotificationAsync(
                        buyer.Email,
                        listing.ListingTitle,
                        conversationId,
                        "Another offer was accepted for this item.");
                }
            }
        }

        // Send acceptance emails to both parties
        var buyerUser = await _mongoDbService.GetUserByIdAsync(conversation.BuyerId);
        var sellerUser = await _mongoDbService.GetUserByIdAsync(conversation.SellerId);

        if (buyerUser?.Email != null && listing != null)
        {
            await _emailService.SendOfferAcceptedNotificationAsync(
                buyerUser.Email,
                listing.ListingTitle,
                acceptedAmount,
                conversationId,
                isBuyer: true);
        }

        if (sellerUser?.Email != null && listing != null)
        {
            await _emailService.SendOfferAcceptedNotificationAsync(
                sellerUser.Email,
                listing.ListingTitle,
                acceptedAmount,
                conversationId,
                isBuyer: false);
        }

        var updated = await _mongoDbService.GetConversationByIdAsync(conversationId);
        return Ok(await MapToConversationDto(updated!, userId));
    }

    /// <summary>
    /// Decline the pending offer
    /// </summary>
    [HttpPost("{conversationId}/decline")]
    public async Task<IActionResult> DeclineOffer(string conversationId, [FromBody] DeclineOfferRequest? request = null)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        if (conversation.Status != ConversationStatus.Active)
        {
            return BadRequest(new { error = "This conversation is no longer active" });
        }

        // Check it's your turn (if there's a pending offer)
        if (conversation.PendingOfferAmount != null)
        {
            bool isBuyer = conversation.BuyerId == userId;
            string myRole = isBuyer ? ActionBy.Buyer : ActionBy.Seller;
            if (conversation.PendingActionBy != myRole)
            {
                return BadRequest(new { error = "It's not your turn to respond" });
            }
        }

        // Add decline event
        await _mongoDbService.AddConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Decline,
            SenderId = userId,
            MessageText = request?.Reason
        });

        // Update conversation
        await _mongoDbService.DeclineConversationAsync(conversationId);

        _logger.LogInformation("Offer declined on conversation {ConversationId}", conversationId);

        // Send email to other party
        bool isBuyerDeclining = conversation.BuyerId == userId;
        var otherUserId = isBuyerDeclining ? conversation.SellerId : conversation.BuyerId;
        var otherUser = await _mongoDbService.GetUserByIdAsync(otherUserId);
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

        if (otherUser?.Email != null && listing != null)
        {
            await _emailService.SendOfferDeclinedNotificationAsync(
                otherUser.Email,
                listing.ListingTitle,
                conversationId,
                request?.Reason);
        }

        var updated = await _mongoDbService.GetConversationByIdAsync(conversationId);
        return Ok(await MapToConversationDto(updated!, userId));
    }

    /// <summary>
    /// Send a message (doesn't affect turn)
    /// </summary>
    [HttpPost("{conversationId}/message")]
    public async Task<IActionResult> SendMessage(string conversationId, [FromBody] SendMessageRequest request)
    {
        var userId = GetUserId();
        if (userId == null) return Unauthorized(new { error = "Invalid token" });

        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { error = "Message cannot be empty" });
        }

        var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
        if (conversation == null)
        {
            return NotFound(new { error = "Conversation not found" });
        }

        // Authorization
        if (conversation.BuyerId != userId && conversation.SellerId != userId)
        {
            return Forbid();
        }

        // Add message event
        await _mongoDbService.AddConversationEventAsync(conversationId, new ConversationEvent
        {
            Type = ConversationEventType.Message,
            SenderId = userId,
            MessageText = request.Message
        });

        var updated = await _mongoDbService.GetConversationByIdAsync(conversationId);
        return Ok(await MapToConversationDto(updated!, userId));
    }

    private string? GetUserId()
    {
        return User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    }

    private async Task<ConversationDto> MapToConversationDto(OfferConversation conversation, string currentUserId)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(conversation.BuyerId);
        var seller = await _mongoDbService.GetUserByIdAsync(conversation.SellerId);

        bool isBuyer = conversation.BuyerId == currentUserId;
        bool isMyTurn = conversation.PendingActionBy == (isBuyer ? ActionBy.Buyer : ActionBy.Seller);

        return new ConversationDto
        {
            Id = conversation.Id!,
            ListingId = conversation.ListingId,
            BuyerId = conversation.BuyerId,
            BuyerName = buyer?.FullName ?? "Unknown",
            SellerId = conversation.SellerId,
            SellerName = seller?.FullName ?? "Unknown",
            PendingOfferAmount = conversation.PendingOfferAmount,
            PendingExpiresAt = conversation.PendingExpiresAt,
            IsMyTurn = isMyTurn,
            IAmBuyer = isBuyer,
            Status = conversation.Status,
            AcceptedAmount = conversation.AcceptedAmount,
            CreatedAt = conversation.CreatedAt,
            UpdatedAt = conversation.UpdatedAt,
            Events = conversation.Events.Select(e => new ConversationEventDto
            {
                Type = e.Type,
                SenderId = e.SenderId,
                MessageText = e.MessageText,
                OfferAmount = e.OfferAmount,
                CreatedAt = e.CreatedAt,
                IsFromMe = e.SenderId == currentUserId
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
public class StartConversationRequest
{
    public string ListingId { get; set; } = string.Empty;
    public string? BuyerId { get; set; } // Only needed if seller is starting
    public decimal? InitialOfferAmount { get; set; }
    public string? Message { get; set; }
}

public class MakeOfferRequest
{
    public decimal Amount { get; set; }
    public string? Message { get; set; }
}

public class DeclineOfferRequest
{
    public string? Reason { get; set; }
}

public class SendMessageRequest
{
    public string Message { get; set; } = string.Empty;
}

// Response DTOs
public class ConversationDto
{
    public string Id { get; set; } = string.Empty;
    public string ListingId { get; set; } = string.Empty;
    public string BuyerId { get; set; } = string.Empty;
    public string BuyerName { get; set; } = string.Empty;
    public string SellerId { get; set; } = string.Empty;
    public string SellerName { get; set; } = string.Empty;
    public decimal? PendingOfferAmount { get; set; }
    public DateTime? PendingExpiresAt { get; set; }
    public bool IsMyTurn { get; set; }
    public bool IAmBuyer { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? AcceptedAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public List<ConversationEventDto> Events { get; set; } = new();
    public ListingSummaryDto? Listing { get; set; }
}

public class ConversationEventDto
{
    public string Type { get; set; } = string.Empty;
    public string? SenderId { get; set; }
    public string? MessageText { get; set; }
    public decimal? OfferAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool IsFromMe { get; set; }
}
```

**Step 2: Verify build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Controllers/ConversationsController.cs
git commit -m "feat: add ConversationsController with turn-based offers"
```

---

## Task 4: Add Email Notification Methods

**Files:**
- Modify: `backend/GuitarDb.API/Services/EmailService.cs`

**Step 1: Add new email methods**

Add these methods to `EmailService.cs`:

```csharp
/// <summary>
/// Send email notification when an offer is made (new or counter)
/// </summary>
public async Task SendOfferNotificationAsync(
    string recipientEmail,
    string listingTitle,
    decimal offerAmount,
    string conversationId,
    bool isCounter)
{
    if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
    {
        _logger.LogDebug("Skipping offer notification - email not configured");
        return;
    }

    var subject = isCounter
        ? $"Counter Offer: {offerAmount:C} for {listingTitle}"
        : $"New Offer: {offerAmount:C} for {listingTitle}";

    var conversationUrl = $"{_frontendUrl}/conversations/{conversationId}";

    var body = $@"
<h2>{(isCounter ? "Counter Offer Received" : "New Offer Received")}</h2>
<p>You have received {(isCounter ? "a counter offer" : "a new offer")} on <strong>{listingTitle}</strong>.</p>

<h3>Offer Details</h3>
<ul>
    <li><strong>Amount:</strong> {offerAmount:C}</li>
</ul>

<p style=""margin: 24px 0;"">
    <a href=""{conversationUrl}"" style=""background-color: #df5e15; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"">View Conversation</a>
</p>

<p>This offer expires in 48 hours. Please respond before it expires.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

    await SendEmailAsync(recipientEmail, subject, body);
}

/// <summary>
/// Send email notification when an offer is accepted (updated with link)
/// </summary>
public async Task SendOfferAcceptedNotificationAsync(
    string recipientEmail,
    string listingTitle,
    decimal acceptedAmount,
    string conversationId,
    bool isBuyer)
{
    if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
    {
        _logger.LogDebug("Skipping offer accepted notification - email not configured");
        return;
    }

    var subject = $"Offer Accepted: {listingTitle}";
    var conversationUrl = $"{_frontendUrl}/conversations/{conversationId}";
    var cartUrl = $"{_frontendUrl}/cart";

    var body = isBuyer
        ? $@"
<h2>Congratulations! Your Offer Was Accepted</h2>
<p>The seller has accepted your offer on <strong>{listingTitle}</strong>.</p>

<h3>Order Details</h3>
<ul>
    <li><strong>Item:</strong> {listingTitle}</li>
    <li><strong>Accepted Price:</strong> {acceptedAmount:C}</li>
</ul>

<p style=""margin: 24px 0;"">
    <a href=""{cartUrl}"" style=""background-color: #df5e15; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"">Complete Purchase</a>
</p>

<p><strong>Important:</strong> Please complete your purchase within 72 hours to secure this item at the agreed price.</p>

<p><a href=""{conversationUrl}"">View Conversation</a></p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
"
        : $@"
<h2>You Accepted an Offer</h2>
<p>You have accepted an offer on <strong>{listingTitle}</strong>.</p>

<h3>Sale Details</h3>
<ul>
    <li><strong>Item:</strong> {listingTitle}</li>
    <li><strong>Accepted Price:</strong> {acceptedAmount:C}</li>
</ul>

<p>The buyer has been notified and has 72 hours to complete the purchase.</p>

<p><a href=""{conversationUrl}"">View Conversation</a></p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

    await SendEmailAsync(recipientEmail, subject, body);
}

/// <summary>
/// Send email notification when an offer is declined
/// </summary>
public async Task SendOfferDeclinedNotificationAsync(
    string recipientEmail,
    string listingTitle,
    string conversationId,
    string? reason = null)
{
    if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
    {
        _logger.LogDebug("Skipping offer declined notification - email not configured");
        return;
    }

    var subject = $"Offer Declined: {listingTitle}";
    var conversationUrl = $"{_frontendUrl}/conversations/{conversationId}";

    var body = $@"
<h2>Offer Declined</h2>
<p>An offer on <strong>{listingTitle}</strong> has been declined.</p>

{(string.IsNullOrEmpty(reason) ? "" : $@"
<h3>Reason</h3>
<p>{reason}</p>
")}

<p><a href=""{conversationUrl}"">View Conversation</a></p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

    await SendEmailAsync(recipientEmail, subject, body);
}

/// <summary>
/// Send email notification when an offer expires
/// </summary>
public async Task SendOfferExpiredNotificationAsync(
    string recipientEmail,
    string listingTitle,
    string conversationId)
{
    if (!_isEnabled || string.IsNullOrEmpty(recipientEmail))
    {
        _logger.LogDebug("Skipping offer expired notification - email not configured");
        return;
    }

    var subject = $"Offer Expired: {listingTitle}";
    var conversationUrl = $"{_frontendUrl}/conversations/{conversationId}";

    var body = $@"
<h2>Offer Expired</h2>
<p>An offer on <strong>{listingTitle}</strong> has expired due to no response within 48 hours.</p>

<p><a href=""{conversationUrl}"">View Conversation</a></p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

    await SendEmailAsync(recipientEmail, subject, body);
}
```

**Step 2: Verify build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/EmailService.cs
git commit -m "feat: add email notifications with conversation links"
```

---

## Task 5: Add Background Job for Offer Expiration

**Files:**
- Create: `backend/GuitarDb.API/Services/OfferExpirationService.cs`
- Modify: `backend/GuitarDb.API/Program.cs`

**Step 1: Create the background service**

```csharp
namespace GuitarDb.API.Services;

public class OfferExpirationService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OfferExpirationService> _logger;
    private readonly TimeSpan _checkInterval = TimeSpan.FromMinutes(15);

    public OfferExpirationService(
        IServiceProvider serviceProvider,
        ILogger<OfferExpirationService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Offer Expiration Service starting");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessExpiredOffersAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing expired offers");
            }

            await Task.Delay(_checkInterval, stoppingToken);
        }
    }

    private async Task ProcessExpiredOffersAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var mongoDbService = scope.ServiceProvider.GetRequiredService<MongoDbService>();
        var emailService = scope.ServiceProvider.GetRequiredService<EmailService>();

        var expiredConversations = await mongoDbService.GetExpiredConversationsAsync();

        if (expiredConversations.Count == 0)
        {
            return;
        }

        _logger.LogInformation("Processing {Count} expired conversations", expiredConversations.Count);

        foreach (var conversation in expiredConversations)
        {
            try
            {
                // Add expire event
                await mongoDbService.AddConversationEventAsync(conversation.Id!, new ConversationEvent
                {
                    Type = ConversationEventType.Expire,
                    MessageText = "Offer expired after 48 hours with no response"
                });

                // Update status
                await mongoDbService.ExpireConversationAsync(conversation.Id!);

                // Send emails to both parties
                var listing = await mongoDbService.GetMyListingByIdAsync(conversation.ListingId);
                if (listing != null)
                {
                    var buyer = await mongoDbService.GetUserByIdAsync(conversation.BuyerId);
                    var seller = await mongoDbService.GetUserByIdAsync(conversation.SellerId);

                    if (buyer?.Email != null)
                    {
                        await emailService.SendOfferExpiredNotificationAsync(
                            buyer.Email,
                            listing.ListingTitle,
                            conversation.Id!);
                    }

                    if (seller?.Email != null)
                    {
                        await emailService.SendOfferExpiredNotificationAsync(
                            seller.Email,
                            listing.ListingTitle,
                            conversation.Id!);
                    }
                }

                _logger.LogInformation("Expired conversation {ConversationId}", conversation.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error expiring conversation {ConversationId}", conversation.Id);
            }
        }
    }
}
```

**Step 2: Register the service in Program.cs**

Add after other service registrations:

```csharp
builder.Services.AddHostedService<OfferExpirationService>();
```

**Step 3: Verify build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add backend/GuitarDb.API/Services/OfferExpirationService.cs backend/GuitarDb.API/Program.cs
git commit -m "feat: add background job for 48-hour offer expiration"
```

---

## Task 6: Create Frontend Types and API

**Files:**
- Create: `frontend/lib/conversations.ts`

**Step 1: Create types and API functions**

```typescript
import api from './api';
import { getAuthHeaders } from './auth';

export interface ListingSummary {
  id: string;
  listingTitle: string;
  price: number;
  currency: string;
  condition: string | null;
  image: string | null;
  disabled: boolean;
}

export interface ConversationEvent {
  type: 'message' | 'offer' | 'accept' | 'decline' | 'expire';
  senderId: string | null;
  messageText: string | null;
  offerAmount: number | null;
  createdAt: string;
  isFromMe: boolean;
}

export interface Conversation {
  id: string;
  listingId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  pendingOfferAmount: number | null;
  pendingExpiresAt: string | null;
  isMyTurn: boolean;
  iAmBuyer: boolean;
  status: 'active' | 'accepted' | 'declined' | 'expired';
  acceptedAmount: number | null;
  createdAt: string;
  updatedAt: string;
  events: ConversationEvent[];
  listing: ListingSummary | null;
}

export async function getConversations(status?: string): Promise<Conversation[]> {
  const endpoint = status ? `/conversations?status=${status}` : '/conversations';
  return api.get<Conversation[]>(endpoint, { headers: getAuthHeaders() });
}

export async function getConversation(id: string): Promise<Conversation> {
  return api.get<Conversation>(`/conversations/${id}`, { headers: getAuthHeaders() });
}

export async function startConversation(
  listingId: string,
  initialOfferAmount?: number,
  message?: string,
  buyerId?: string
): Promise<Conversation> {
  return api.post<Conversation>(
    '/conversations',
    { listingId, initialOfferAmount, message, buyerId },
    { headers: getAuthHeaders() }
  );
}

export async function makeOffer(
  conversationId: string,
  amount: number,
  message?: string
): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/offer`,
    { amount, message },
    { headers: getAuthHeaders() }
  );
}

export async function acceptOffer(conversationId: string): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/accept`,
    {},
    { headers: getAuthHeaders() }
  );
}

export async function declineOffer(
  conversationId: string,
  reason?: string
): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/decline`,
    { reason },
    { headers: getAuthHeaders() }
  );
}

export async function sendMessage(
  conversationId: string,
  message: string
): Promise<Conversation> {
  return api.post<Conversation>(
    `/conversations/${conversationId}/message`,
    { message },
    { headers: getAuthHeaders() }
  );
}

export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
}
```

**Step 2: Commit**

```bash
git add frontend/lib/conversations.ts
git commit -m "feat: add frontend API functions for conversations"
```

---

## Task 7: Create ConversationCard Component

**Files:**
- Create: `frontend/components/conversations/ConversationCard.tsx`

**Step 1: Create the component**

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Conversation, formatTimeRemaining } from '@/lib/conversations';

interface ConversationCardProps {
  conversation: Conversation;
}

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getStatusBadge(conversation: Conversation) {
  switch (conversation.status) {
    case 'active':
      if (conversation.isMyTurn) {
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <AlertCircle className="h-3 w-3 mr-1" />
            Your Turn
          </Badge>
        );
      }
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Waiting
        </Badge>
      );
    case 'accepted':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Accepted
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Declined
        </Badge>
      );
    case 'expired':
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    default:
      return <Badge variant="outline">{conversation.status}</Badge>;
  }
}

export function ConversationCard({ conversation }: ConversationCardProps) {
  const listing = conversation.listing;
  const lastOffer = conversation.events
    .filter(e => e.type === 'offer')
    .pop();

  return (
    <Link href={`/conversations/${conversation.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col cursor-pointer">
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-muted to-muted/50">
          {listing?.image ? (
            <Image
              src={listing.image}
              alt={listing.listingTitle}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <span className="text-6xl">🎸</span>
            </div>
          )}
          {listing?.disabled && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-semibold">SOLD</span>
            </div>
          )}
        </div>
        <CardContent className="flex flex-col flex-1 p-4">
          <div className="flex justify-between items-start mb-2">
            {getStatusBadge(conversation)}
            <span className="text-xs text-muted-foreground">{formatDate(conversation.updatedAt)}</span>
          </div>

          {listing && (
            <h3 className="font-semibold text-lg mb-2 line-clamp-2 hover:text-[#df5e15] transition-colors">
              {listing.listingTitle}
            </h3>
          )}

          <div className="space-y-1 mb-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">List Price:</span>
              <span className="font-medium">
                {listing ? formatPrice(listing.price, listing.currency) : 'N/A'}
              </span>
            </div>
            {lastOffer && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Last Offer:</span>
                <span className="font-bold text-[#df5e15]">
                  {formatPrice(lastOffer.offerAmount!)}
                </span>
              </div>
            )}
            {conversation.acceptedAmount && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Agreed Price:</span>
                <span className="font-bold text-green-600">
                  {formatPrice(conversation.acceptedAmount)}
                </span>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground mb-2">
            {conversation.iAmBuyer ? `Seller: ${conversation.sellerName}` : `Buyer: ${conversation.buyerName}`}
          </div>

          {conversation.status === 'active' && conversation.pendingExpiresAt && (
            <div className="mt-auto pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                {formatTimeRemaining(conversation.pendingExpiresAt)}
              </p>
            </div>
          )}

          {conversation.isMyTurn && conversation.status === 'active' && (
            <div className="mt-2 bg-orange-50 border border-orange-200 rounded-md p-2">
              <p className="text-sm text-orange-700">
                Action required - respond to this offer
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/conversations/ConversationCard.tsx
git commit -m "feat: add ConversationCard component"
```

---

## Task 8: Create Conversations List Page

**Files:**
- Create: `frontend/app/conversations/page.tsx`

**Step 1: Create the page**

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getConversations, Conversation } from '@/lib/conversations';
import { ConversationCard } from '@/components/conversations/ConversationCard';

type StatusFilter = 'all' | 'active' | 'accepted' | 'declined' | 'expired';

export default function ConversationsPage() {
  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchConversations = async () => {
      try {
        const data = await getConversations(statusFilter === 'all' ? undefined : statusFilter);
        setConversations(data);
      } catch (error) {
        console.error('Failed to fetch conversations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [isAuthenticated, authLoading, statusFilter]);

  const filterCounts = {
    all: conversations.length,
    active: conversations.filter(c => c.status === 'active').length,
    accepted: conversations.filter(c => c.status === 'accepted').length,
    declined: conversations.filter(c => c.status === 'declined').length,
    expired: conversations.filter(c => c.status === 'expired').length,
  };

  const myTurnCount = conversations.filter(c => c.isMyTurn && c.status === 'active').length;

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to listings
        </Link>

        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">Sign in to view your conversations</h2>
            <p className="text-muted-foreground">
              Create an account or sign in to negotiate offers on guitars.
            </p>
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
            >
              Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Link
        href="/"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to listings
      </Link>

      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">My Conversations</h1>
        <p className="text-muted-foreground">
          Negotiate offers with buyers and sellers
        </p>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(['all', 'active', 'accepted', 'declined', 'expired'] as StatusFilter[]).map((status) => (
          <Button
            key={status}
            variant={statusFilter === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setStatusFilter(status)}
            className={statusFilter === status ? 'bg-[#df5e15] hover:bg-[#c54d0a]' : ''}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && ` (${filterCounts.all})`}
            {status === 'active' && myTurnCount > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5">
                {myTurnCount}
              </span>
            )}
          </Button>
        ))}
      </div>

      {conversations.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <MessageSquare className="h-16 w-16 text-muted-foreground" />
            <h2 className="text-2xl font-semibold">
              {statusFilter === 'all' ? 'No conversations yet' : `No ${statusFilter} conversations`}
            </h2>
            <p className="text-muted-foreground">
              {statusFilter === 'all'
                ? 'Browse listings and make an offer to start negotiating.'
                : `You don't have any conversations with ${statusFilter} status.`}
            </p>
            <Link href="/">
              <Button className="bg-[#df5e15] hover:bg-[#c54d0a] text-white">
                Browse Listings
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {conversations.map(conversation => (
            <ConversationCard key={conversation.id} conversation={conversation} />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/conversations/page.tsx
git commit -m "feat: add conversations list page"
```

---

## Task 9: Create OfferBubble Component

**Files:**
- Create: `frontend/components/conversations/OfferBubble.tsx`

**Step 1: Create the component**

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { ConversationEvent, formatTimeRemaining } from '@/lib/conversations';
import { CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';

interface OfferBubbleProps {
  event: ConversationEvent;
  isMyTurn: boolean;
  pendingExpiresAt: string | null;
  conversationStatus: string;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: (amount: number) => void;
  isLoading: boolean;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function OfferBubble({
  event,
  isMyTurn,
  pendingExpiresAt,
  conversationStatus,
  onAccept,
  onDecline,
  onCounter,
  isLoading,
}: OfferBubbleProps) {
  const isActive = conversationStatus === 'active';
  const showActions = isMyTurn && isActive && !event.isFromMe;

  // Determine bubble styling based on who sent it and the event type
  const isFromMe = event.isFromMe;
  const bubbleClasses = isFromMe
    ? 'ml-auto bg-[#df5e15] text-white'
    : 'mr-auto bg-muted';

  if (event.type === 'accept') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-green-100 border border-green-300 rounded-lg px-4 py-2 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-green-800 font-medium">
            Offer of {formatPrice(event.offerAmount!)} accepted
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'decline') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-red-100 border border-red-300 rounded-lg px-4 py-2 flex items-center gap-2">
          <XCircle className="h-5 w-5 text-red-600" />
          <span className="text-red-800 font-medium">
            Offer declined
            {event.messageText && `: ${event.messageText}`}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'expire') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-2 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-600" />
          <span className="text-gray-800 font-medium">
            {event.messageText || 'Offer expired'}
          </span>
        </div>
      </div>
    );
  }

  if (event.type === 'offer') {
    return (
      <div className={`flex flex-col max-w-[80%] ${isFromMe ? 'items-end ml-auto' : 'items-start mr-auto'}`}>
        <div className={`rounded-lg p-4 ${bubbleClasses}`}>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-5 w-5" />
            <span className="text-2xl font-bold">{formatPrice(event.offerAmount!)}</span>
          </div>
          <p className="text-sm opacity-90">
            {isFromMe ? 'You offered' : 'Offered'}
          </p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">{formatTime(event.createdAt)}</span>

        {showActions && (
          <div className="flex flex-col gap-2 mt-3 w-full">
            {pendingExpiresAt && (
              <p className="text-xs text-muted-foreground">
                {formatTimeRemaining(pendingExpiresAt)}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                onClick={onAccept}
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                onClick={onDecline}
                disabled={isLoading}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-1" />
                Decline
              </Button>
            </div>
            <Button
              onClick={() => {
                const amount = prompt('Enter counter offer amount:');
                if (amount && !isNaN(parseFloat(amount))) {
                  onCounter(parseFloat(amount));
                }
              }}
              disabled={isLoading}
              variant="outline"
              className="w-full"
            >
              Counter Offer
            </Button>
          </div>
        )}

        {!isActive && !isFromMe && event.type === 'offer' && (
          <div className="mt-2 text-xs text-muted-foreground italic">
            {conversationStatus === 'accepted' && 'This offer was accepted'}
            {conversationStatus === 'declined' && 'This conversation was declined'}
            {conversationStatus === 'expired' && 'This offer expired'}
          </div>
        )}
      </div>
    );
  }

  // Regular message
  return (
    <div className={`flex flex-col max-w-[80%] ${isFromMe ? 'items-end ml-auto' : 'items-start mr-auto'}`}>
      <div className={`rounded-lg px-4 py-2 ${bubbleClasses}`}>
        <p>{event.messageText}</p>
      </div>
      <span className="text-xs text-muted-foreground mt-1">{formatTime(event.createdAt)}</span>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/components/conversations/OfferBubble.tsx
git commit -m "feat: add OfferBubble component with actions"
```

---

## Task 10: Create Conversation Detail Page

**Files:**
- Create: `frontend/app/conversations/[conversationId]/page.tsx`

**Step 1: Create the page**

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, Send, DollarSign, ShoppingCart } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getConversation,
  makeOffer,
  acceptOffer,
  declineOffer,
  sendMessage,
  Conversation,
} from '@/lib/conversations';
import { OfferBubble } from '@/components/conversations/OfferBubble';

function formatPrice(price: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.conversationId as string;

  const { isAuthenticated, isLoading: authLoading, setShowLoginModal } = useAuth();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActioning, setIsActioning] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [offerInput, setOfferInput] = useState('');
  const [showOfferInput, setShowOfferInput] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const fetchConversation = async () => {
      try {
        const data = await getConversation(conversationId);
        setConversation(data);
      } catch (error) {
        console.error('Failed to fetch conversation:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversation();
  }, [isAuthenticated, authLoading, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation?.events]);

  const handleAccept = async () => {
    if (!conversation) return;
    setIsActioning(true);
    try {
      const updated = await acceptOffer(conversation.id);
      setConversation(updated);
    } catch (error) {
      console.error('Failed to accept offer:', error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleDecline = async () => {
    if (!conversation) return;
    const reason = prompt('Reason for declining (optional):');
    setIsActioning(true);
    try {
      const updated = await declineOffer(conversation.id, reason || undefined);
      setConversation(updated);
    } catch (error) {
      console.error('Failed to decline offer:', error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleMakeOffer = async (amount: number) => {
    if (!conversation) return;
    setIsActioning(true);
    try {
      const updated = await makeOffer(conversation.id, amount);
      setConversation(updated);
      setOfferInput('');
      setShowOfferInput(false);
    } catch (error) {
      console.error('Failed to make offer:', error);
    } finally {
      setIsActioning(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!conversation || !messageInput.trim()) return;
    setIsActioning(true);
    try {
      const updated = await sendMessage(conversation.id, messageInput);
      setConversation(updated);
      setMessageInput('');
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsActioning(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-2xl font-semibold">Sign in to view this conversation</h2>
            <Button
              onClick={() => setShowLoginModal(true)}
              className="bg-[#df5e15] hover:bg-[#c54d0a] text-white"
            >
              Sign In
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-12 text-center">
          <h2 className="text-2xl font-semibold">Conversation not found</h2>
          <Link href="/conversations">
            <Button className="mt-4">Back to Conversations</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const listing = conversation.listing;
  const canMakeOffer = conversation.status === 'active' &&
    (conversation.isMyTurn || conversation.pendingOfferAmount === null);

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Link
        href="/conversations"
        className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to conversations
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Listing Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-4">
              {listing && (
                <>
                  <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden mb-4">
                    {listing.image ? (
                      <Image
                        src={listing.image}
                        alt={listing.listingTitle}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl">🎸</span>
                      </div>
                    )}
                  </div>
                  <Link href={`/listing/${listing.id}`}>
                    <h3 className="font-semibold text-lg hover:text-[#df5e15] transition-colors">
                      {listing.listingTitle}
                    </h3>
                  </Link>
                  <p className="text-2xl font-bold mt-2">
                    {formatPrice(listing.price, listing.currency)}
                  </p>
                  {listing.condition && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Used - {listing.condition}
                    </p>
                  )}
                </>
              )}

              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  {conversation.iAmBuyer ? 'Seller' : 'Buyer'}:
                </p>
                <p className="font-medium">
                  {conversation.iAmBuyer ? conversation.sellerName : conversation.buyerName}
                </p>
              </div>

              {conversation.status === 'accepted' && (
                <div className="mt-4">
                  <Badge className="w-full justify-center py-2 bg-green-600">
                    Accepted: {formatPrice(conversation.acceptedAmount!)}
                  </Badge>
                  {conversation.iAmBuyer && (
                    <Link href="/cart">
                      <Button className="w-full mt-2 bg-[#df5e15] hover:bg-[#c54d0a]">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Go to Cart
                      </Button>
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Chat Thread */}
        <div className="lg:col-span-2">
          <Card className="h-[600px] flex flex-col">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversation.events.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                conversation.events.map((event, index) => (
                  <OfferBubble
                    key={index}
                    event={event}
                    isMyTurn={conversation.isMyTurn}
                    pendingExpiresAt={conversation.pendingExpiresAt}
                    conversationStatus={conversation.status}
                    onAccept={handleAccept}
                    onDecline={handleDecline}
                    onCounter={handleMakeOffer}
                    isLoading={isActioning}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            {conversation.status === 'active' && (
              <div className="border-t p-4">
                {showOfferInput ? (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="Enter offer amount"
                      value={offerInput}
                      onChange={(e) => setOfferInput(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={() => {
                        if (offerInput && !isNaN(parseFloat(offerInput))) {
                          handleMakeOffer(parseFloat(offerInput));
                        }
                      }}
                      disabled={isActioning || !offerInput}
                      className="bg-[#df5e15] hover:bg-[#c54d0a]"
                    >
                      Send Offer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowOfferInput(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <form onSubmit={handleSendMessage} className="flex-1 flex gap-2">
                      <Input
                        placeholder="Type a message..."
                        value={messageInput}
                        onChange={(e) => setMessageInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="submit"
                        disabled={isActioning || !messageInput.trim()}
                        variant="outline"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </form>
                    {canMakeOffer && (
                      <Button
                        onClick={() => setShowOfferInput(true)}
                        className="bg-[#df5e15] hover:bg-[#c54d0a]"
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Make Offer
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/conversations/[conversationId]/page.tsx
git commit -m "feat: add conversation detail page with chat UI"
```

---

## Task 11: Update MakeOfferModal to Use Conversations

**Files:**
- Modify: `frontend/components/offers/MakeOfferModal.tsx`

**Step 1: Read current file and update to use conversations API**

Update the modal to call the conversations API instead of the old offers API:

```tsx
// Replace the handleSubmit function to use conversations
const handleSubmit = async () => {
  if (!offerAmount || offerAmount <= 0) return;

  setIsSubmitting(true);
  try {
    // Use conversations API - startConversation with initial offer
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        listingId: listing.id,
        initialOfferAmount: offerAmount,
        message: message || undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to submit offer');
    }

    const conversation = await response.json();
    setShowSuccess(true);

    // Redirect to the conversation after a brief delay
    setTimeout(() => {
      onClose();
      window.location.href = `/conversations/${conversation.id}`;
    }, 1500);
  } catch (error) {
    console.error('Failed to submit offer:', error);
    alert(error instanceof Error ? error.message : 'Failed to submit offer');
  } finally {
    setIsSubmitting(false);
  }
};
```

**Step 2: Commit**

```bash
git add frontend/components/offers/MakeOfferModal.tsx
git commit -m "feat: update MakeOfferModal to use conversations API"
```

---

## Task 12: Update Navigation Links

**Files:**
- Modify: `frontend/components/nav/Navbar.tsx` (or similar navigation component)

**Step 1: Change /offers links to /conversations**

Find and replace navigation links from `/offers` to `/conversations` in the navbar.

**Step 2: Commit**

```bash
git add frontend/components/nav/Navbar.tsx
git commit -m "feat: update navigation to use /conversations route"
```

---

## Task 13: Add Admin Conversations Endpoint

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs`

**Step 1: Add admin endpoint for viewing all conversations**

```csharp
/// <summary>
/// Get all conversations (admin only)
/// </summary>
[HttpGet("conversations")]
public async Task<IActionResult> GetAllConversations([FromQuery] string? status = null)
{
    var conversations = await _mongoDbService.GetAllConversationsAsync(status);

    var result = new List<object>();
    foreach (var conv in conversations)
    {
        var listing = await _mongoDbService.GetMyListingByIdAsync(conv.ListingId);
        var buyer = await _mongoDbService.GetUserByIdAsync(conv.BuyerId);
        var seller = await _mongoDbService.GetUserByIdAsync(conv.SellerId);

        result.Add(new
        {
            conv.Id,
            conv.ListingId,
            ListingTitle = listing?.ListingTitle ?? "Unknown",
            conv.BuyerId,
            BuyerName = buyer?.FullName ?? "Unknown",
            BuyerEmail = buyer?.Email,
            conv.SellerId,
            SellerName = seller?.FullName ?? "Unknown",
            conv.PendingOfferAmount,
            conv.PendingExpiresAt,
            conv.Status,
            conv.AcceptedAmount,
            conv.CreatedAt,
            conv.UpdatedAt,
            EventCount = conv.Events.Count
        });
    }

    return Ok(result);
}
```

**Step 2: Commit**

```bash
git add backend/GuitarDb.API/Controllers/AdminController.cs
git commit -m "feat: add admin endpoint for viewing conversations"
```

---

## Task 14: Data Migration Script

**Files:**
- Create: `backend/GuitarDb.API/Scripts/MigrateOffersToConversations.cs`

**Step 1: Create migration utility**

```csharp
// This can be run as a one-time migration console command or integrated into startup
using GuitarDb.API.Models;
using MongoDB.Driver;

namespace GuitarDb.API.Scripts;

public class MigrateOffersToConversations
{
    private readonly IMongoCollection<Offer> _offersCollection;
    private readonly IMongoCollection<OfferConversation> _conversationsCollection;
    private readonly IMongoCollection<Listing> _listingsCollection;

    public MigrateOffersToConversations(IMongoDatabase database)
    {
        _offersCollection = database.GetCollection<Offer>("offers");
        _conversationsCollection = database.GetCollection<OfferConversation>("conversations");
        _listingsCollection = database.GetCollection<Listing>("listings");
    }

    public async Task MigrateAsync()
    {
        var offers = await _offersCollection.Find(_ => true).ToListAsync();

        foreach (var offer in offers)
        {
            // Check if already migrated
            var existing = await _conversationsCollection
                .Find(c => c.BuyerId == offer.BuyerId && c.ListingId == offer.ListingId)
                .FirstOrDefaultAsync();

            if (existing != null) continue;

            // Get seller from listing
            var listing = await _listingsCollection
                .Find(l => l.Id == offer.ListingId)
                .FirstOrDefaultAsync();

            if (listing == null) continue;

            // Convert messages to events
            var events = new List<ConversationEvent>();
            foreach (var msg in offer.Messages)
            {
                if (msg.IsSystemMessage && msg.MessageText.Contains("Offer of"))
                {
                    events.Add(new ConversationEvent
                    {
                        Type = ConversationEventType.Offer,
                        SenderId = msg.SenderId,
                        OfferAmount = offer.InitialOfferAmount,
                        CreatedAt = msg.CreatedAt
                    });
                }
                else if (msg.IsSystemMessage && msg.MessageText.Contains("Counter offer"))
                {
                    events.Add(new ConversationEvent
                    {
                        Type = ConversationEventType.Offer,
                        SenderId = msg.SenderId,
                        OfferAmount = offer.CounterOfferAmount ?? 0,
                        CreatedAt = msg.CreatedAt
                    });
                }
                else if (msg.IsSystemMessage && msg.MessageText.Contains("accepted"))
                {
                    events.Add(new ConversationEvent
                    {
                        Type = ConversationEventType.Accept,
                        SenderId = msg.SenderId,
                        OfferAmount = offer.CounterOfferAmount ?? offer.CurrentOfferAmount,
                        CreatedAt = msg.CreatedAt
                    });
                }
                else if (msg.IsSystemMessage && msg.MessageText.Contains("rejected"))
                {
                    events.Add(new ConversationEvent
                    {
                        Type = ConversationEventType.Decline,
                        SenderId = msg.SenderId,
                        CreatedAt = msg.CreatedAt
                    });
                }
                else
                {
                    events.Add(new ConversationEvent
                    {
                        Type = ConversationEventType.Message,
                        SenderId = msg.SenderId,
                        MessageText = msg.MessageText,
                        CreatedAt = msg.CreatedAt
                    });
                }
            }

            // Map status
            var status = offer.Status switch
            {
                OfferStatus.Accepted => ConversationStatus.Accepted,
                OfferStatus.Rejected => ConversationStatus.Declined,
                _ => ConversationStatus.Active
            };

            // Determine pending action
            string? pendingActionBy = null;
            decimal? pendingOfferAmount = null;
            if (status == ConversationStatus.Active)
            {
                if (offer.Status == OfferStatus.Countered)
                {
                    pendingActionBy = ActionBy.Buyer;
                    pendingOfferAmount = offer.CounterOfferAmount;
                }
                else if (offer.Status == OfferStatus.Pending)
                {
                    pendingActionBy = ActionBy.Seller;
                    pendingOfferAmount = offer.CurrentOfferAmount;
                }
            }

            var conversation = new OfferConversation
            {
                ListingId = offer.ListingId,
                BuyerId = offer.BuyerId,
                SellerId = listing.UserId ?? "",
                PendingActionBy = pendingActionBy,
                PendingOfferAmount = pendingOfferAmount,
                Status = status,
                AcceptedAmount = status == ConversationStatus.Accepted
                    ? (offer.CounterOfferAmount ?? offer.CurrentOfferAmount)
                    : null,
                Events = events,
                CreatedAt = offer.CreatedAt,
                UpdatedAt = offer.UpdatedAt
            };

            await _conversationsCollection.InsertOneAsync(conversation);
        }
    }
}
```

**Step 2: Commit**

```bash
git add backend/GuitarDb.API/Scripts/MigrateOffersToConversations.cs
git commit -m "feat: add migration script for offers to conversations"
```

---

## Task 15: Final Cleanup and Testing

**Step 1: Run the backend**

```bash
cd backend/GuitarDb.API && dotnet run
```

**Step 2: Run the frontend**

```bash
cd frontend && npm run dev
```

**Step 3: Test the flow**
1. Make an offer on a listing
2. Verify conversation is created
3. Test counter-offer flow
4. Test accept/decline
5. Verify emails are sent with correct links
6. Test expiration (may need to manually set short expiry for testing)

**Step 4: Run E2E tests**

```bash
cd frontend && npx playwright test offers
```

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete offer system rework to conversation model"
```

---

## Summary

This implementation plan converts the offer system from a confusing counter-offer model to a chat-like conversation model with:

- Turn-based negotiation (only recipient can respond)
- 48-hour offer expiration with background job
- Unified event stream (messages + offers in one thread)
- Proper authorization (only buyer/seller can access)
- Email notifications with direct links to conversations
- Migration path for existing data
