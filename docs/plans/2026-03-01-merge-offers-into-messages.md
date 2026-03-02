# Merge Offers into Messages Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify offer_conversations and messages into a single conversation system where offers are typed messages.

**Architecture:** Extend existing Conversation model with offer state fields. Extend Message model with type field. Offers appear as special messages in the conversation thread. One active offer per conversation.

**Tech Stack:** C# ASP.NET Core, MongoDB, Next.js, TypeScript, Tailwind CSS

---

### Task 1: Add Offer Fields to Conversation Model

**Files:**
- Modify: `backend/GuitarDb.API/Models/Conversation.cs`

**Step 1: Add offer state fields to Conversation model**

```csharp
[BsonElement("active_offer_amount")]
[BsonIgnoreIfNull]
public decimal? ActiveOfferAmount { get; set; }

[BsonElement("active_offer_by")]
[BsonIgnoreIfNull]
public string? ActiveOfferBy { get; set; }

[BsonElement("pending_action_by")]
[BsonIgnoreIfNull]
public string? PendingActionBy { get; set; }  // "buyer" or "seller"

[BsonElement("offer_expires_at")]
[BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
[BsonIgnoreIfNull]
public DateTime? OfferExpiresAt { get; set; }

[BsonElement("offer_status")]
[BsonIgnoreIfNull]
public string? OfferStatus { get; set; }  // "active", "accepted", "declined", "expired"

[BsonElement("accepted_amount")]
[BsonIgnoreIfNull]
public decimal? AcceptedAmount { get; set; }
```

**Step 2: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/Conversation.cs
git commit -m "feat: add offer state fields to Conversation model"
```

---

### Task 2: Add Type Field to Message Model

**Files:**
- Modify: `backend/GuitarDb.API/Models/Message.cs`

**Step 1: Add type and offer amount fields**

```csharp
[BsonElement("type")]
public string Type { get; set; } = "text";  // "text", "offer", "accept", "decline", "expire"

[BsonElement("offer_amount")]
[BsonIgnoreIfNull]
public decimal? OfferAmount { get; set; }
```

**Step 2: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/Message.cs
git commit -m "feat: add type and offer_amount fields to Message model"
```

---

### Task 3: Add MongoDbService Methods for Offer Operations

**Files:**
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs`

**Step 1: Add method to update conversation offer state**

Add after `UpdateConversationLastMessageAsync`:

```csharp
public async Task UpdateConversationOfferStateAsync(
    string conversationId,
    decimal? activeOfferAmount,
    string? activeOfferBy,
    string? pendingActionBy,
    DateTime? offerExpiresAt,
    string? offerStatus,
    decimal? acceptedAmount = null)
{
    var update = Builders<Conversation>.Update
        .Set(c => c.ActiveOfferAmount, activeOfferAmount)
        .Set(c => c.ActiveOfferBy, activeOfferBy)
        .Set(c => c.PendingActionBy, pendingActionBy)
        .Set(c => c.OfferExpiresAt, offerExpiresAt)
        .Set(c => c.OfferStatus, offerStatus)
        .Set(c => c.AcceptedAmount, acceptedAmount);

    await _conversationsCollection.UpdateOneAsync(
        c => c.Id == conversationId,
        update);
}
```

**Step 2: Add method to get conversations with offers**

```csharp
public async Task<List<Conversation>> GetConversationsWithOffersAsync(string? status = null)
{
    var filter = Builders<Conversation>.Filter.Ne(c => c.OfferStatus, null);
    if (status != null)
    {
        filter = Builders<Conversation>.Filter.Eq(c => c.OfferStatus, status);
    }
    return await _conversationsCollection
        .Find(filter)
        .SortByDescending(c => c.LastMessageAt)
        .ToListAsync();
}
```

**Step 3: Add method to get expired offer conversations**

```csharp
public async Task<List<Conversation>> GetExpiredOfferConversationsAsync()
{
    var filter = Builders<Conversation>.Filter.And(
        Builders<Conversation>.Filter.Eq(c => c.OfferStatus, "active"),
        Builders<Conversation>.Filter.Lt(c => c.OfferExpiresAt, DateTime.UtcNow)
    );
    return await _conversationsCollection.Find(filter).ToListAsync();
}
```

**Step 4: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 5: Commit**

```bash
git add backend/GuitarDb.API/Services/MongoDbService.cs
git commit -m "feat: add MongoDbService methods for offer operations"
```

---

### Task 4: Add Offer Endpoints to MessagesController

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/MessagesController.cs`

**Step 1: Add offer expiration constant and request classes at bottom of file**

```csharp
public class MakeOfferRequest
{
    public decimal OfferAmount { get; set; }
    public string? Message { get; set; }
}

public class DeclineOfferRequest
{
    public string? Reason { get; set; }
}
```

**Step 2: Add MakeOffer endpoint**

Add after SendMessageInConversation method:

```csharp
private static readonly TimeSpan OfferExpiration = TimeSpan.FromHours(48);

/// <summary>
/// Make an offer in a conversation (must have listingId)
/// </summary>
[HttpPost("conversations/{conversationId}/offer")]
public async Task<IActionResult> MakeOffer(string conversationId, [FromBody] MakeOfferRequest request)
{
    var userId = GetUserId();
    if (userId == null) return Unauthorized(new { error = "Invalid token" });

    if (request.OfferAmount <= 0)
        return BadRequest(new { error = "Offer amount must be positive" });

    if (request.OfferAmount > 99999)
        return BadRequest(new { error = "Offer amount cannot exceed $99,999" });

    var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
    if (conversation == null)
        return NotFound(new { error = "Conversation not found" });

    if (!conversation.ParticipantIds.Contains(userId))
        return Forbid();

    if (conversation.ListingId == null)
        return BadRequest(new { error = "Cannot make offer - conversation not linked to a listing" });

    if (conversation.OfferStatus == "active")
        return BadRequest(new { error = "There is already an active offer in this conversation" });

    // Determine buyer/seller
    var admin = await _mongoDbService.GetAdminUserAsync();
    var isBuyer = userId != admin?.Id;
    var otherUserId = conversation.ParticipantIds.First(p => p != userId);
    var pendingActionBy = isBuyer ? "seller" : "buyer";

    // Create offer message
    var message = await _mongoDbService.CreateMessageAsync(new Message
    {
        ConversationId = conversationId,
        SenderId = userId,
        RecipientId = otherUserId,
        ListingId = conversation.ListingId,
        MessageText = request.Message ?? $"Offer: ${request.OfferAmount:N0}",
        Type = "offer",
        OfferAmount = request.OfferAmount
    });

    // Update conversation state
    await _mongoDbService.UpdateConversationOfferStateAsync(
        conversationId,
        activeOfferAmount: request.OfferAmount,
        activeOfferBy: userId,
        pendingActionBy: pendingActionBy,
        offerExpiresAt: DateTime.UtcNow.Add(OfferExpiration),
        offerStatus: "active"
    );

    await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, $"Offer: ${request.OfferAmount:N0}");

    // Send email notification
    var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
    var sender = await _mongoDbService.GetUserByIdAsync(userId);
    var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

    if (recipient?.Email != null)
    {
        await _emailService.SendOfferNotificationAsync(
            recipient.Email,
            sender?.FullName ?? "Someone",
            request.OfferAmount,
            listing?.ListingTitle ?? "a listing",
            conversationId
        );
    }

    return Ok(new { success = true, messageId = message.Id });
}
```

**Step 3: Add AcceptOffer endpoint**

```csharp
/// <summary>
/// Accept the active offer
/// </summary>
[HttpPost("conversations/{conversationId}/accept")]
public async Task<IActionResult> AcceptOffer(string conversationId)
{
    var userId = GetUserId();
    if (userId == null) return Unauthorized(new { error = "Invalid token" });

    var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
    if (conversation == null)
        return NotFound(new { error = "Conversation not found" });

    if (!conversation.ParticipantIds.Contains(userId))
        return Forbid();

    if (conversation.OfferStatus != "active")
        return BadRequest(new { error = "No active offer to accept" });

    // Verify it's the recipient's turn
    var admin = await _mongoDbService.GetAdminUserAsync();
    var isBuyer = userId != admin?.Id;
    var expectedPendingBy = isBuyer ? "buyer" : "seller";

    if (conversation.PendingActionBy != expectedPendingBy)
        return BadRequest(new { error = "It's not your turn to respond to this offer" });

    var otherUserId = conversation.ParticipantIds.First(p => p != userId);
    var acceptedAmount = conversation.ActiveOfferAmount ?? 0;

    // Create accept message
    await _mongoDbService.CreateMessageAsync(new Message
    {
        ConversationId = conversationId,
        SenderId = userId,
        RecipientId = otherUserId,
        ListingId = conversation.ListingId,
        MessageText = $"Accepted offer of ${acceptedAmount:N0}",
        Type = "accept",
        OfferAmount = acceptedAmount
    });

    // Update conversation state
    await _mongoDbService.UpdateConversationOfferStateAsync(
        conversationId,
        activeOfferAmount: null,
        activeOfferBy: null,
        pendingActionBy: null,
        offerExpiresAt: null,
        offerStatus: "accepted",
        acceptedAmount: acceptedAmount
    );

    await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, $"Offer accepted: ${acceptedAmount:N0}");

    // Send email notification
    var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
    var sender = await _mongoDbService.GetUserByIdAsync(userId);
    var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

    if (recipient?.Email != null)
    {
        await _emailService.SendOfferAcceptedWithLinkAsync(
            recipient.Email,
            acceptedAmount,
            listing?.ListingTitle ?? "a listing",
            conversationId
        );
    }

    // Add to pending cart items (72 hour hold)
    if (conversation.ListingId != null)
    {
        await _mongoDbService.AddPendingCartItemAsync(new PendingCartItem
        {
            UserId = conversation.ActiveOfferBy ?? otherUserId,
            ListingId = conversation.ListingId,
            OfferId = conversationId,
            AcceptedPrice = acceptedAmount,
            ExpiresAt = DateTime.UtcNow.AddHours(72)
        });
    }

    return Ok(new { success = true, acceptedAmount });
}
```

**Step 4: Add DeclineOffer endpoint**

```csharp
/// <summary>
/// Decline the active offer
/// </summary>
[HttpPost("conversations/{conversationId}/decline")]
public async Task<IActionResult> DeclineOffer(string conversationId, [FromBody] DeclineOfferRequest? request = null)
{
    var userId = GetUserId();
    if (userId == null) return Unauthorized(new { error = "Invalid token" });

    var conversation = await _mongoDbService.GetConversationByIdAsync(conversationId);
    if (conversation == null)
        return NotFound(new { error = "Conversation not found" });

    if (!conversation.ParticipantIds.Contains(userId))
        return Forbid();

    if (conversation.OfferStatus != "active")
        return BadRequest(new { error = "No active offer to decline" });

    // Verify it's the recipient's turn
    var admin = await _mongoDbService.GetAdminUserAsync();
    var isBuyer = userId != admin?.Id;
    var expectedPendingBy = isBuyer ? "buyer" : "seller";

    if (conversation.PendingActionBy != expectedPendingBy)
        return BadRequest(new { error = "It's not your turn to respond to this offer" });

    var otherUserId = conversation.ParticipantIds.First(p => p != userId);
    var declinedAmount = conversation.ActiveOfferAmount ?? 0;

    // Create decline message
    var messageText = string.IsNullOrWhiteSpace(request?.Reason)
        ? $"Declined offer of ${declinedAmount:N0}"
        : $"Declined offer of ${declinedAmount:N0}: {request.Reason}";

    await _mongoDbService.CreateMessageAsync(new Message
    {
        ConversationId = conversationId,
        SenderId = userId,
        RecipientId = otherUserId,
        ListingId = conversation.ListingId,
        MessageText = messageText,
        Type = "decline",
        OfferAmount = declinedAmount
    });

    // Update conversation state
    await _mongoDbService.UpdateConversationOfferStateAsync(
        conversationId,
        activeOfferAmount: null,
        activeOfferBy: null,
        pendingActionBy: null,
        offerExpiresAt: null,
        offerStatus: "declined"
    );

    await _mongoDbService.UpdateConversationLastMessageAsync(conversationId, "Offer declined");

    // Send email notification
    var recipient = await _mongoDbService.GetUserByIdAsync(otherUserId);
    var listing = await _mongoDbService.GetMyListingByIdAsync(conversation.ListingId);

    if (recipient?.Email != null)
    {
        await _emailService.SendOfferDeclinedNotificationAsync(
            recipient.Email,
            listing?.ListingTitle ?? "a listing",
            conversationId
        );
    }

    return Ok(new { success = true });
}
```

**Step 5: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 6: Commit**

```bash
git add backend/GuitarDb.API/Controllers/MessagesController.cs
git commit -m "feat: add offer/accept/decline endpoints to MessagesController"
```

---

### Task 5: Update ConversationDto to Include Offer State

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/MessagesController.cs`

**Step 1: Update ConversationDto class**

Find ConversationDto and add these fields:

```csharp
public decimal? ActiveOfferAmount { get; set; }
public string? ActiveOfferBy { get; set; }
public string? PendingActionBy { get; set; }
public DateTime? OfferExpiresAt { get; set; }
public string? OfferStatus { get; set; }
public decimal? AcceptedAmount { get; set; }
```

**Step 2: Update GetConversations to populate offer fields**

In the `GetConversations` method, update the ConversationDto creation:

```csharp
result.Add(new ConversationDto
{
    Id = conv.Id!,
    OtherUserId = otherUserId,
    OtherUserName = otherUser?.FullName ?? "Unknown",
    ListingId = conv.ListingId,
    ListingTitle = listing?.ListingTitle,
    ListingImage = listing?.Images?.FirstOrDefault(),
    LastMessage = conv.LastMessage,
    LastMessageAt = conv.LastMessageAt,
    CreatedAt = conv.CreatedAt,
    UnreadCount = unreadCount,
    // Offer fields
    ActiveOfferAmount = conv.ActiveOfferAmount,
    ActiveOfferBy = conv.ActiveOfferBy,
    PendingActionBy = conv.PendingActionBy,
    OfferExpiresAt = conv.OfferExpiresAt,
    OfferStatus = conv.OfferStatus,
    AcceptedAmount = conv.AcceptedAmount
});
```

**Step 3: Update MessageDto class**

Find MessageDto and add:

```csharp
public string Type { get; set; } = "text";
public decimal? OfferAmount { get; set; }
```

**Step 4: Update GetConversationMessages to populate type fields**

In GetConversationMessages, update the MessageDto creation:

```csharp
var result = messages.Select(m => new MessageDto
{
    Id = m.Id!,
    ConversationId = m.ConversationId,
    SenderId = m.SenderId,
    RecipientId = m.RecipientId,
    ListingId = m.ListingId,
    MessageText = m.MessageText,
    ImageUrls = m.ImageUrls,
    CreatedAt = m.CreatedAt,
    IsRead = m.IsRead,
    IsMine = m.SenderId == userId,
    Type = m.Type,
    OfferAmount = m.OfferAmount
}).ToList();
```

**Step 5: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 6: Commit**

```bash
git add backend/GuitarDb.API/Controllers/MessagesController.cs
git commit -m "feat: add offer fields to ConversationDto and MessageDto"
```

---

### Task 6: Add Admin Offers Endpoint

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs`

**Step 1: Add GetOffersAdmin endpoint**

Add after existing admin endpoints:

```csharp
/// <summary>
/// Get all conversations with offers (admin only)
/// </summary>
[HttpGet("offers")]
public async Task<IActionResult> GetOffersAdmin([FromQuery] string? status = null)
{
    var userId = GetUserId();
    if (userId == null) return Unauthorized(new { error = "Invalid token" });

    var user = await _mongoDbService.GetUserByIdAsync(userId);
    if (user == null || !user.IsAdmin)
        return Forbid();

    var conversations = await _mongoDbService.GetConversationsWithOffersAsync(status);

    var result = new List<object>();
    foreach (var conv in conversations)
    {
        var buyerId = conv.ParticipantIds.FirstOrDefault(p => p != userId);
        var buyer = buyerId != null ? await _mongoDbService.GetUserByIdAsync(buyerId) : null;

        MyListing? listing = null;
        if (conv.ListingId != null)
        {
            listing = await _mongoDbService.GetMyListingByIdAsync(conv.ListingId);
        }

        result.Add(new
        {
            Id = conv.Id,
            BuyerId = buyerId,
            BuyerName = buyer?.FullName ?? "Unknown",
            BuyerEmail = buyer?.Email,
            ListingId = conv.ListingId,
            ListingTitle = listing?.ListingTitle,
            ListingImage = listing?.Images?.FirstOrDefault(),
            ListingPrice = listing?.Price,
            ActiveOfferAmount = conv.ActiveOfferAmount,
            ActiveOfferBy = conv.ActiveOfferBy,
            PendingActionBy = conv.PendingActionBy,
            OfferExpiresAt = conv.OfferExpiresAt,
            OfferStatus = conv.OfferStatus,
            AcceptedAmount = conv.AcceptedAmount,
            LastMessage = conv.LastMessage,
            LastMessageAt = conv.LastMessageAt,
            CreatedAt = conv.CreatedAt
        });
    }

    return Ok(result);
}
```

**Step 2: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Controllers/AdminController.cs
git commit -m "feat: add admin offers endpoint"
```

---

### Task 7: Update OfferExpirationService

**Files:**
- Modify: `backend/GuitarDb.API/Services/OfferExpirationService.cs`

**Step 1: Update to use conversations collection**

Replace the entire ExecuteAsync implementation:

```csharp
protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    while (!stoppingToken.IsCancellationRequested)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var mongoDb = scope.ServiceProvider.GetRequiredService<MongoDbService>();
            var emailService = scope.ServiceProvider.GetRequiredService<EmailService>();

            var expiredConversations = await mongoDb.GetExpiredOfferConversationsAsync();

            foreach (var conv in expiredConversations)
            {
                try
                {
                    var otherUserId = conv.ParticipantIds.FirstOrDefault(p => p != conv.ActiveOfferBy);

                    // Create expire message
                    if (otherUserId != null && conv.ActiveOfferBy != null)
                    {
                        await mongoDb.CreateMessageAsync(new Message
                        {
                            ConversationId = conv.Id!,
                            SenderId = "system",
                            RecipientId = otherUserId,
                            ListingId = conv.ListingId,
                            MessageText = $"Offer of ${conv.ActiveOfferAmount:N0} expired",
                            Type = "expire",
                            OfferAmount = conv.ActiveOfferAmount
                        });
                    }

                    // Update conversation state
                    await mongoDb.UpdateConversationOfferStateAsync(
                        conv.Id!,
                        activeOfferAmount: null,
                        activeOfferBy: null,
                        pendingActionBy: null,
                        offerExpiresAt: null,
                        offerStatus: "expired"
                    );

                    await mongoDb.UpdateConversationLastMessageAsync(conv.Id!, "Offer expired");

                    // Send notification
                    if (conv.ActiveOfferBy != null)
                    {
                        var offerMaker = await mongoDb.GetUserByIdAsync(conv.ActiveOfferBy);
                        MyListing? listing = null;
                        if (conv.ListingId != null)
                        {
                            listing = await mongoDb.GetMyListingByIdAsync(conv.ListingId);
                        }

                        if (offerMaker?.Email != null)
                        {
                            await emailService.SendOfferExpiredNotificationAsync(
                                offerMaker.Email,
                                listing?.ListingTitle ?? "a listing",
                                conv.Id!
                            );
                        }
                    }

                    _logger.LogInformation("Expired offer in conversation {ConversationId}", conv.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error expiring offer in conversation {ConversationId}", conv.Id);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in offer expiration service");
        }

        await Task.Delay(TimeSpan.FromMinutes(15), stoppingToken);
    }
}
```

**Step 2: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/OfferExpirationService.cs
git commit -m "feat: update OfferExpirationService to use conversations collection"
```

---

### Task 8: Update Frontend Message Types

**Files:**
- Modify: `frontend/app/messages/[conversationId]/page.tsx`

**Step 1: Update Message interface**

```typescript
interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  listingId: string | null;
  messageText: string;
  imageUrls?: string[];
  createdAt: string;
  isRead: boolean;
  isMine: boolean;
  type: 'text' | 'offer' | 'accept' | 'decline' | 'expire';
  offerAmount?: number;
}
```

**Step 2: Update Conversation interface**

```typescript
interface Conversation {
  id: string;
  otherUserId: string | null;
  otherUserName: string;
  listingId: string | null;
  listingTitle: string | null;
  listingImage: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  // Offer fields
  activeOfferAmount?: number;
  activeOfferBy?: string;
  pendingActionBy?: 'buyer' | 'seller';
  offerExpiresAt?: string;
  offerStatus?: 'active' | 'accepted' | 'declined' | 'expired';
  acceptedAmount?: number;
}
```

**Step 3: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add frontend/app/messages/[conversationId]/page.tsx
git commit -m "feat: update frontend message types with offer fields"
```

---

### Task 9: Add Offer Bubble Component to Messages Page

**Files:**
- Modify: `frontend/app/messages/[conversationId]/page.tsx`

**Step 1: Add OfferBubble component inside the file**

Add before the main component:

```tsx
function OfferBubble({
  message,
  isMyTurn,
  onAccept,
  onDecline,
  onCounter
}: {
  message: Message;
  isMyTurn: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCounter: () => void;
}) {
  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);

  if (message.type === 'accept') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium">
          Offer accepted: {formatPrice(message.offerAmount || 0)}
        </div>
      </div>
    );
  }

  if (message.type === 'decline') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-full text-sm font-medium">
          Offer declined
        </div>
      </div>
    );
  }

  if (message.type === 'expire') {
    return (
      <div className="flex justify-center my-4">
        <div className="bg-gray-100 text-gray-600 px-4 py-2 rounded-full text-sm font-medium">
          Offer expired
        </div>
      </div>
    );
  }

  // Offer message
  return (
    <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'} my-2`}>
      <div className={`max-w-[80%] rounded-lg p-4 ${
        message.isMine ? 'bg-[#df5e15] text-white' : 'bg-blue-100 text-blue-900'
      }`}>
        <div className="text-xs uppercase tracking-wide opacity-75 mb-1">
          {message.isMine ? 'Your Offer' : 'Their Offer'}
        </div>
        <div className="text-2xl font-bold">
          {formatPrice(message.offerAmount || 0)}
        </div>
        {!message.isMine && isMyTurn && (
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="secondary" onClick={onAccept} className="bg-green-500 hover:bg-green-600 text-white">
              Accept
            </Button>
            <Button size="sm" variant="secondary" onClick={onCounter} className="bg-blue-500 hover:bg-blue-600 text-white">
              Counter
            </Button>
            <Button size="sm" variant="secondary" onClick={onDecline} className="bg-red-500 hover:bg-red-600 text-white">
              Decline
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Update message rendering in the main component**

Find the message rendering loop and update to handle offer types:

```tsx
{messages.map((message, index) => {
  const prevMessage = index > 0 ? messages[index - 1] : null;
  const showDateSeparator = shouldShowDateSeparator(message, prevMessage);

  // Check if this is an offer-type message
  const isOfferMessage = ['offer', 'accept', 'decline', 'expire'].includes(message.type);

  return (
    <div key={message.id}>
      {showDateSeparator && (
        <div className="flex justify-center my-4">
          <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
            {formatDate(message.createdAt)}
          </span>
        </div>
      )}

      {isOfferMessage ? (
        <OfferBubble
          message={message}
          isMyTurn={conversation?.pendingActionBy === (/* determine buyer/seller */)}
          onAccept={handleAcceptOffer}
          onDecline={handleDeclineOffer}
          onCounter={() => setShowOfferModal(true)}
        />
      ) : (
        // Existing text message rendering
        <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'} mb-2`}>
          {/* ... existing message bubble code ... */}
        </div>
      )}
    </div>
  );
})}
```

**Step 3: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add frontend/app/messages/[conversationId]/page.tsx
git commit -m "feat: add OfferBubble component to messages page"
```

---

### Task 10: Add Offer Actions to Messages Page

**Files:**
- Modify: `frontend/app/messages/[conversationId]/page.tsx`

**Step 1: Add state for offer actions**

```tsx
const [isAccepting, setIsAccepting] = useState(false);
const [isDeclining, setIsDeclining] = useState(false);
```

**Step 2: Add handleAcceptOffer function**

```tsx
const handleAcceptOffer = async () => {
  if (!conversationId || isAccepting) return;

  setIsAccepting(true);
  try {
    await api.authPost(`/messages/conversations/${conversationId}/accept`, {});
    // Refresh messages
    const updatedMessages = await api.authGet<Message[]>(`/messages/conversation/${conversationId}`);
    setMessages(updatedMessages);
    // Refresh conversation
    const convs = await api.authGet<Conversation[]>('/messages/conversations');
    const updated = convs.find(c => c.id === conversationId);
    if (updated) setConversation(updated);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to accept offer');
  } finally {
    setIsAccepting(false);
  }
};
```

**Step 3: Add handleDeclineOffer function**

```tsx
const handleDeclineOffer = async () => {
  if (!conversationId || isDeclining) return;

  setIsDeclining(true);
  try {
    await api.authPost(`/messages/conversations/${conversationId}/decline`, {});
    // Refresh messages
    const updatedMessages = await api.authGet<Message[]>(`/messages/conversation/${conversationId}`);
    setMessages(updatedMessages);
    // Refresh conversation
    const convs = await api.authGet<Conversation[]>('/messages/conversations');
    const updated = convs.find(c => c.id === conversationId);
    if (updated) setConversation(updated);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to decline offer');
  } finally {
    setIsDeclining(false);
  }
};
```

**Step 4: Update MakeOfferModal integration**

Update the MakeOfferModal to call the new endpoint:

```tsx
// In handleOfferSuccess or update MakeOfferModal to use /messages/conversations/{id}/offer
const handleMakeOffer = async (amount: number) => {
  await api.authPost(`/messages/conversations/${conversationId}/offer`, {
    offerAmount: amount
  });
  // Refresh conversation and messages
  setShowOfferModal(false);
  // ... refresh logic
};
```

**Step 5: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 6: Commit**

```bash
git add frontend/app/messages/[conversationId]/page.tsx
git commit -m "feat: add offer accept/decline/counter actions to messages page"
```

---

### Task 11: Add Make Offer Button to Messages Page

**Files:**
- Modify: `frontend/app/messages/[conversationId]/page.tsx`

**Step 1: Add Make Offer button in the message input area**

Find the message input area and add a Make Offer button:

```tsx
{/* Show Make Offer button if conversation has listing and no active offer */}
{conversation?.listingId && conversation?.offerStatus !== 'active' && (
  <Button
    variant="outline"
    size="sm"
    onClick={() => setShowOfferModal(true)}
    className="flex items-center gap-1"
  >
    <Tag className="h-4 w-4" />
    Make Offer
  </Button>
)}
```

**Step 2: Update MakeOfferModal to work with conversation**

The modal needs to call `/messages/conversations/{id}/offer` instead of creating a new conversation.

**Step 3: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add frontend/app/messages/[conversationId]/page.tsx
git commit -m "feat: add Make Offer button to messages page"
```

---

### Task 12: Update Profile Page Links

**Files:**
- Modify: `frontend/app/profile/page.tsx`

**Step 1: Update quickLinks array**

Change "Negotiations" to "Offers" and update href:

```tsx
const quickLinks = [
  {
    href: '/favorites',
    icon: Heart,
    title: 'Favorites',
    description: 'View your saved listings',
  },
  {
    href: '/messages?filter=offers',
    icon: Tag,
    title: 'Offers',
    description: 'View your offer conversations',
  },
  {
    href: '/messages',
    icon: MessageSquare,
    title: 'Messages',
    description: 'View all conversations',
  },
];
```

**Step 2: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add frontend/app/profile/page.tsx
git commit -m "feat: update profile page links - rename Negotiations to Offers"
```

---

### Task 13: Update Admin Portal Offers Tab

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Add new offers state**

```tsx
const [adminOffers, setAdminOffers] = useState<any[]>([]);
const [offersLoading, setOffersLoading] = useState(false);
```

**Step 2: Add fetch function for offers**

```tsx
const fetchAdminOffers = async () => {
  setOffersLoading(true);
  try {
    const offers = await api.authGet<any[]>('/admin/offers');
    setAdminOffers(offers);
  } catch (err) {
    console.error('Failed to fetch offers:', err);
  } finally {
    setOffersLoading(false);
  }
};
```

**Step 3: Replace old offers TabsContent**

Replace the entire offers tab content with new implementation that shows conversation-based offers with links to `/messages/{id}`.

**Step 4: Remove old OfferCard import and usage**

Remove `import { OfferCard, AdminOffer } from '@/components/admin/OfferCard';`

**Step 5: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 6: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: update admin portal offers tab to use conversation-based offers"
```

---

### Task 14: Update Notifications Component

**Files:**
- Modify: `frontend/components/Notifications.tsx`

**Step 1: Update offer notification links**

Change `/conversations/${notification.offerId}` to `/messages/${notification.offerId}`:

```tsx
<Link href={`/messages/${notification.offerId}`}>
```

**Step 2: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add frontend/components/Notifications.tsx
git commit -m "feat: update notification links to use /messages route"
```

---

### Task 15: Update ProfileButton Links

**Files:**
- Modify: `frontend/components/auth/ProfileButton.tsx`

**Step 1: Update all /conversations links to /messages**

Replace all occurrences of `/conversations` with `/messages`.

**Step 2: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add frontend/components/auth/ProfileButton.tsx
git commit -m "feat: update ProfileButton links to use /messages route"
```

---

### Task 16: Add Messages Filter for Offers

**Files:**
- Modify: `frontend/app/messages/page.tsx`

**Step 1: Add filter state and UI**

```tsx
const [filter, setFilter] = useState<'all' | 'offers'>('all');

// Read filter from URL params
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('filter') === 'offers') {
    setFilter('offers');
  }
}, []);

// Filter conversations
const filteredConversations = filter === 'offers'
  ? conversations.filter(c => c.offerStatus != null)
  : conversations;
```

**Step 2: Add filter tabs UI**

```tsx
<div className="flex gap-2 mb-4">
  <Button
    variant={filter === 'all' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setFilter('all')}
  >
    All Messages
  </Button>
  <Button
    variant={filter === 'offers' ? 'default' : 'outline'}
    size="sm"
    onClick={() => setFilter('offers')}
  >
    With Offers
  </Button>
</div>
```

**Step 3: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add frontend/app/messages/page.tsx
git commit -m "feat: add offer filter to messages list page"
```

---

### Task 17: Create Data Migration Script

**Files:**
- Modify: `backend/GuitarDb.API/Scripts/MigrateOffersToConversations.cs`

**Step 1: Update migration to use messages system**

Update the migration script to:
1. Find or create Conversation (not OfferConversation)
2. Create Message documents for each event
3. Set offer state on Conversation

**Step 2: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Scripts/MigrateOffersToConversations.cs
git commit -m "feat: update migration script for unified messages system"
```

---

### Task 18: Delete Old Conversations System

**Files:**
- Delete: `frontend/app/conversations/page.tsx`
- Delete: `frontend/app/conversations/[conversationId]/page.tsx`
- Delete: `frontend/components/conversations/ConversationCard.tsx`
- Delete: `frontend/components/conversations/OfferBubble.tsx`
- Delete: `frontend/lib/conversations.ts`
- Delete: `frontend/app/offers/page.tsx`
- Delete: `frontend/app/offers/[offerId]/page.tsx`

**Step 1: Delete frontend files**

```bash
rm -rf frontend/app/conversations
rm -rf frontend/components/conversations
rm frontend/lib/conversations.ts
rm -rf frontend/app/offers
```

**Step 2: Verify build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete old conversations and offers routes"
```

---

### Task 19: Delete Backend Conversations Controller

**Files:**
- Delete: `backend/GuitarDb.API/Controllers/ConversationsController.cs`
- Delete: `backend/GuitarDb.API/Models/OfferConversation.cs`

**Step 1: Delete backend files**

```bash
rm backend/GuitarDb.API/Controllers/ConversationsController.cs
rm backend/GuitarDb.API/Models/OfferConversation.cs
```

**Step 2: Remove OfferConversation references from MongoDbService**

Remove all `*OfferConversation*` methods and `_offerConversationsCollection` field.

**Step 3: Verify build**

Run: `dotnet build --no-restore` in `backend/GuitarDb.API`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete old ConversationsController and OfferConversation model"
```

---

### Task 20: Final Verification

**Step 1: Full backend build**

Run: `dotnet build` in `backend/GuitarDb.API`
Expected: Build succeeded with 0 errors

**Step 2: Full frontend build**

Run: `npm run build` in `frontend`
Expected: Build succeeded

**Step 3: Manual testing checklist**

- [ ] Send text message in conversation
- [ ] Make offer in listing-linked conversation
- [ ] Accept offer
- [ ] Decline offer
- [ ] Counter offer
- [ ] Verify offer expiration works
- [ ] Admin can view all offers
- [ ] Profile links work
- [ ] Notifications link to correct pages

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete merge of offers into messages system"
```
