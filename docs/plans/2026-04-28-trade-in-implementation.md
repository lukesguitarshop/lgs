# Trade-In Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a logged-in trade-in flow where users submit a guitar, receive dual cash/credit offers from admin, ship with an admin-supplied label, and receive payout — with full store-credit integration into the existing checkout.

**Architecture:** ASP.NET Core controllers (`TradeInsController`, `AdminTradeInsController`, `StoreCreditController`) backed by two new MongoDB collections (`trade_in_requests`, `store_credits`). Photos and offers embedded on the request document. Existing `EmailService` extended with new templates. Existing `CheckoutController` modified to accept and apply store credit. Frontend uses Next.js App Router pages under `/trade-in`, `/account`, and `/admin/trade-ins`.

**Tech Stack:** .NET 9 / ASP.NET Core controllers / MongoDB driver / JWT auth / SMTP via System.Net.Mail / Next.js 16 App Router / React 19 / shadcn/ui / Tailwind 4 / Playwright e2e

**Reference design doc:** `docs/plans/2026-04-28-trade-in-design.md`

---

## Conventions (read before any task)

- **Backend models**: `[BsonId]` + `[BsonRepresentation(BsonType.ObjectId)]` on Id; `[BsonElement("snake_case")]` for all properties; `[BsonRepresentation(BsonType.ObjectId)]` on FK strings; `[BsonIgnoreIfNull]` for nullables; `[BsonDateTimeOptions(Kind = DateTimeKind.Utc)]` on DateTimes; static class for status string constants.
- **Controllers**: `[ApiController]` + `[Route("api/...")]`; `[Authorize]` for user-facing, `[AdminAuthorize]` (from `GuitarDb.API.Attributes`) for admin. Use `GetUserId()` helper that reads `ClaimTypes.NameIdentifier` from `User.Identity`.
- **Mongo wiring**: register collection field in `MongoDbService` ctor; add indexes in `CreateIndexesAsync()`; expose async helper methods.
- **Email**: extend `EmailService` with new methods. Each method: early-return when `!_isEnabled`, log debug/info, never throw. Use `_frontendUrl` for links.
- **Frontend api**: use `api.authPost/authGet/authPut/authPatch/authDelete` from `lib/api.ts` for authed calls. For multipart uploads, build a `FormData` and pass headers manually (see `app/messages/[conversationId]/page.tsx` for reference).
- **Frontend auth gating**: copy the pattern from `app/checkout/page.tsx` lines 182–214 — show a "sign in required" stub with `useAuth().setShowLoginModal(true)` button.
- **Toasts**: import `useToast` from `components/ui/toast` and call `showToast(message, 'success' | 'error' | 'info')`.
- **Branding colors**: primary action `#6E0114` (hover `#580110`), text `#020E1C`, surface `#FFFFF3`. Match existing pages.
- **Commit style**: Conventional Commits (`feat:`, `fix:`, `docs:`). One commit per task. Always end commit messages with the Claude co-author trailer.

---

## Task 1: Add `TradeInRequest` model

**Files:**
- Create: `backend/GuitarDb.API/Models/TradeInRequest.cs`

**Step 1: Write the model**

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class TradeInRequest
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("email")]
    public string Email { get; set; } = string.Empty;

    [BsonElement("brand")]
    public string Brand { get; set; } = string.Empty;

    [BsonElement("model")]
    public string Model { get; set; } = string.Empty;

    [BsonElement("condition")]
    public string Condition { get; set; } = string.Empty;

    [BsonElement("notes")]
    public string Notes { get; set; } = string.Empty;

    [BsonElement("photos")]
    public List<TradeInPhoto> Photos { get; set; } = new();

    [BsonElement("offers")]
    public List<TradeInOffer> Offers { get; set; } = new();

    [BsonElement("status")]
    public string Status { get; set; } = TradeInStatus.Submitted;

    [BsonElement("shipping")]
    public TradeInShipping Shipping { get; set; } = new();

    [BsonElement("payout")]
    public TradeInPayout Payout { get; set; } = new();

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class TradeInPhoto
{
    [BsonElement("url")]
    public string Url { get; set; } = string.Empty;

    [BsonElement("original_file_name")]
    public string OriginalFileName { get; set; } = string.Empty;

    [BsonElement("uploaded_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
}

public class TradeInOffer
{
    [BsonElement("cash_offer")]
    public decimal CashOffer { get; set; }

    [BsonElement("store_credit_offer")]
    public decimal StoreCreditOffer { get; set; }

    [BsonElement("expires_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime ExpiresAt { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("created_by_admin_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string CreatedByAdminId { get; set; } = string.Empty;

    [BsonElement("accepted_type")]
    [BsonIgnoreIfNull]
    public string? AcceptedType { get; set; }

    [BsonElement("accepted_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? AcceptedAt { get; set; }

    [BsonElement("paypal_email")]
    [BsonIgnoreIfNull]
    public string? PaypalEmail { get; set; }

    [BsonElement("declined_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? DeclinedAt { get; set; }
}

public class TradeInShipping
{
    [BsonElement("label_url")]
    [BsonIgnoreIfNull]
    public string? LabelUrl { get; set; }

    [BsonElement("label_uploaded_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? LabelUploadedAt { get; set; }

    [BsonElement("received_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? ReceivedAt { get; set; }

    [BsonElement("inspected_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? InspectedAt { get; set; }

    [BsonElement("inspection_notes")]
    [BsonIgnoreIfNull]
    public string? InspectionNotes { get; set; }
}

public class TradeInPayout
{
    [BsonElement("completed_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? CompletedAt { get; set; }

    [BsonElement("paid_at")]
    [BsonIgnoreIfNull]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime? PaidAt { get; set; }

    [BsonElement("paypal_transaction_id")]
    [BsonIgnoreIfNull]
    public string? PaypalTransactionId { get; set; }

    [BsonElement("store_credit_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? StoreCreditId { get; set; }
}

public static class TradeInStatus
{
    public const string Submitted = "submitted";
    public const string Offered = "offered";
    public const string Accepted = "accepted";
    public const string Declined = "declined";
    public const string Expired = "expired";
    public const string Received = "received";
    public const string Inspected = "inspected";
    public const string Completed = "completed";
    public const string Cancelled = "cancelled";
}

public static class TradeInOfferType
{
    public const string Cash = "cash";
    public const string Credit = "credit";
}
```

**Step 2: Build and verify**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeds, 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/TradeInRequest.cs
git commit -m "feat(trade-in): add TradeInRequest model with embedded photos/offers"
```

---

## Task 2: Add `StoreCredit` model

**Files:**
- Create: `backend/GuitarDb.API/Models/StoreCredit.cs`

**Step 1: Write the model**

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class StoreCredit
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("user_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    public string UserId { get; set; } = string.Empty;

    [BsonElement("balance")]
    public decimal Balance { get; set; }

    [BsonElement("history")]
    public List<StoreCreditEntry> History { get; set; } = new();

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class StoreCreditEntry
{
    [BsonElement("type")]
    public string Type { get; set; } = string.Empty; // "credit" or "debit"

    [BsonElement("amount")]
    public decimal Amount { get; set; }

    [BsonElement("reason")]
    public string Reason { get; set; } = string.Empty;

    [BsonElement("ref_id")]
    [BsonRepresentation(BsonType.ObjectId)]
    [BsonIgnoreIfNull]
    public string? RefId { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public static class StoreCreditEntryType
{
    public const string Credit = "credit";
    public const string Debit = "debit";
}
```

**Step 2: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Models/StoreCredit.cs
git commit -m "feat(store-credit): add StoreCredit model"
```

---

## Task 3: Register collections + indexes in MongoDbService

**Files:**
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs`

**Step 1: Add collection fields**

In the field-declaration block (after `_monthlySnapshotsCollection`), add:

```csharp
private readonly IMongoCollection<TradeInRequest> _tradeInRequestsCollection;
private readonly IMongoCollection<StoreCredit> _storeCreditsCollection;
```

**Step 2: Initialize them in the constructor**

After the `_monthlySnapshotsCollection = ...` line, add:

```csharp
_tradeInRequestsCollection = database.GetCollection<TradeInRequest>("trade_in_requests");
_storeCreditsCollection = database.GetCollection<StoreCredit>("store_credits");
```

**Step 3: Add indexes**

At the end of `CreateIndexesAsync()` (just before the catch), add:

```csharp
// Trade-in indexes
var tradeInUserIndex = Builders<TradeInRequest>.IndexKeys.Ascending(t => t.UserId);
await _tradeInRequestsCollection.Indexes.CreateOneAsync(
    new CreateIndexModel<TradeInRequest>(tradeInUserIndex, new CreateIndexOptions { Name = "user_id_idx" })
);

var tradeInStatusIndex = Builders<TradeInRequest>.IndexKeys.Ascending(t => t.Status);
await _tradeInRequestsCollection.Indexes.CreateOneAsync(
    new CreateIndexModel<TradeInRequest>(tradeInStatusIndex, new CreateIndexOptions { Name = "status_idx" })
);

var tradeInCreatedAtIndex = Builders<TradeInRequest>.IndexKeys.Descending(t => t.CreatedAt);
await _tradeInRequestsCollection.Indexes.CreateOneAsync(
    new CreateIndexModel<TradeInRequest>(tradeInCreatedAtIndex, new CreateIndexOptions { Name = "created_at_idx" })
);

// Store credit indexes
var storeCreditUserIndex = Builders<StoreCredit>.IndexKeys.Ascending(s => s.UserId);
await _storeCreditsCollection.Indexes.CreateOneAsync(
    new CreateIndexModel<StoreCredit>(storeCreditUserIndex, new CreateIndexOptions { Name = "user_id_idx", Unique = true })
);
```

**Step 4: Add helper methods**

At the end of `MongoDbService` (before the closing class brace), add the data-access methods. Group them under `// Trade-in helpers` and `// Store credit helpers`:

```csharp
// Trade-in helpers
public async Task<TradeInRequest> CreateTradeInRequestAsync(TradeInRequest request)
{
    request.CreatedAt = DateTime.UtcNow;
    request.UpdatedAt = DateTime.UtcNow;
    await _tradeInRequestsCollection.InsertOneAsync(request);
    return request;
}

public async Task<TradeInRequest?> GetTradeInRequestByIdAsync(string id)
{
    return await _tradeInRequestsCollection.Find(t => t.Id == id).FirstOrDefaultAsync();
}

public async Task<List<TradeInRequest>> GetTradeInRequestsByUserAsync(string userId)
{
    return await _tradeInRequestsCollection
        .Find(t => t.UserId == userId)
        .SortByDescending(t => t.CreatedAt)
        .ToListAsync();
}

public async Task<List<TradeInRequest>> GetAllTradeInRequestsAsync(string? statusFilter = null)
{
    var filter = string.IsNullOrEmpty(statusFilter)
        ? Builders<TradeInRequest>.Filter.Empty
        : Builders<TradeInRequest>.Filter.Eq(t => t.Status, statusFilter);
    return await _tradeInRequestsCollection
        .Find(filter)
        .SortByDescending(t => t.CreatedAt)
        .ToListAsync();
}

public async Task<bool> UpdateTradeInRequestAsync(TradeInRequest request)
{
    request.UpdatedAt = DateTime.UtcNow;
    var result = await _tradeInRequestsCollection.ReplaceOneAsync(
        t => t.Id == request.Id, request);
    return result.ModifiedCount > 0;
}

// Store credit helpers
public async Task<StoreCredit?> GetStoreCreditByUserAsync(string userId)
{
    return await _storeCreditsCollection.Find(s => s.UserId == userId).FirstOrDefaultAsync();
}

public async Task<StoreCredit> CreateOrCreditUserAsync(string userId, decimal amount, string reason, string? refId = null)
{
    var existing = await GetStoreCreditByUserAsync(userId);
    var entry = new StoreCreditEntry
    {
        Type = StoreCreditEntryType.Credit,
        Amount = amount,
        Reason = reason,
        RefId = refId
    };

    if (existing == null)
    {
        var sc = new StoreCredit
        {
            UserId = userId,
            Balance = amount,
            History = new List<StoreCreditEntry> { entry }
        };
        await _storeCreditsCollection.InsertOneAsync(sc);
        return sc;
    }

    var update = Builders<StoreCredit>.Update
        .Inc(s => s.Balance, amount)
        .Push(s => s.History, entry)
        .Set(s => s.UpdatedAt, DateTime.UtcNow);
    await _storeCreditsCollection.UpdateOneAsync(s => s.Id == existing.Id, update);
    existing.Balance += amount;
    existing.History.Add(entry);
    return existing;
}

public async Task<bool> DebitUserStoreCreditAsync(string userId, decimal amount, string reason, string? refId = null)
{
    var existing = await GetStoreCreditByUserAsync(userId);
    if (existing == null || existing.Balance < amount) return false;

    var entry = new StoreCreditEntry
    {
        Type = StoreCreditEntryType.Debit,
        Amount = amount,
        Reason = reason,
        RefId = refId
    };
    var update = Builders<StoreCredit>.Update
        .Inc(s => s.Balance, -amount)
        .Push(s => s.History, entry)
        .Set(s => s.UpdatedAt, DateTime.UtcNow);
    var filter = Builders<StoreCredit>.Filter.And(
        Builders<StoreCredit>.Filter.Eq(s => s.UserId, userId),
        Builders<StoreCredit>.Filter.Gte(s => s.Balance, amount));
    var result = await _storeCreditsCollection.UpdateOneAsync(filter, update);
    return result.ModifiedCount > 0;
}
```

**Step 5: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 6: Commit**

```bash
git add backend/GuitarDb.API/Services/MongoDbService.cs
git commit -m "feat(trade-in): register trade-in and store-credit collections with indexes and helpers"
```

---

## Task 4: Add DTOs for trade-in API

**Files:**
- Create: `backend/GuitarDb.API/DTOs/TradeInDtos.cs`

**Step 1: Write DTOs**

```csharp
using Microsoft.AspNetCore.Http;

namespace GuitarDb.API.DTOs;

// User-facing
public class SubmitTradeInRequest
{
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public List<IFormFile>? Photos { get; set; }
}

public class AcceptTradeInOfferRequest
{
    public string Type { get; set; } = string.Empty; // "cash" or "credit"
    public string? PaypalEmail { get; set; } // required when type == "cash"
}

public class TradeInRequestDto
{
    public string Id { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string Notes { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public List<TradeInPhotoDto> Photos { get; set; } = new();
    public TradeInOfferDto? ActiveOffer { get; set; }
    public TradeInShippingDto? Shipping { get; set; }
    public TradeInPayoutDto? Payout { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class TradeInPhotoDto
{
    public string Url { get; set; } = string.Empty;
}

public class TradeInOfferDto
{
    public decimal CashOffer { get; set; }
    public decimal StoreCreditOffer { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string? AcceptedType { get; set; }
    public DateTime? AcceptedAt { get; set; }
    public DateTime? DeclinedAt { get; set; }
    public bool IsExpired { get; set; }
}

public class TradeInShippingDto
{
    public string? LabelUrl { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public DateTime? InspectedAt { get; set; }
}

public class TradeInPayoutDto
{
    public DateTime? CompletedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}

// Admin
public class AdminTradeInListItemDto
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Condition { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class AdminTradeInDetailDto : TradeInRequestDto
{
    public string Email { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public List<TradeInOfferDto> AllOffers { get; set; } = new();
    public string? PaypalEmail { get; set; }
    public string? PaypalTransactionId { get; set; }
    public string? InspectionNotes { get; set; }
}

public class CreateTradeInOfferRequest
{
    public decimal CashOffer { get; set; }
    public decimal StoreCreditOffer { get; set; }
    public int ExpirationDays { get; set; } = 7;
}

public class MarkInspectedRequest
{
    public string? Notes { get; set; }
}

public class MarkPaidRequest
{
    public string? PaypalTransactionId { get; set; }
}

// Store credit
public class StoreCreditDto
{
    public decimal Balance { get; set; }
    public List<StoreCreditEntryDto> History { get; set; } = new();
}

public class StoreCreditEntryDto
{
    public string Type { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
```

**Step 2: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/DTOs/TradeInDtos.cs
git commit -m "feat(trade-in): add request/response DTOs"
```

---

## Task 5: Add email templates for trade-in events

**Files:**
- Modify: `backend/GuitarDb.API/Services/EmailService.cs`

**Step 1: Add 7 new methods at the end of `EmailService` class (before `GetTrackingUrl`)**

Each follows the existing pattern: early-return if `!_isEnabled`, build subject + HTML body, call `SendEmailAsync`. Use `_frontendUrl` for links (`{_frontendUrl}/trade-in/{id}`).

```csharp
public async Task SendTradeInSubmittedAsync(string toEmail, string requestId, string brand, string model)
{
    if (!_isEnabled || string.IsNullOrEmpty(toEmail)) return;
    var subject = "We received your trade-in request";
    var body = $@"
<h2>Thanks for submitting!</h2>
<p>We received your trade-in request for your <strong>{brand} {model}</strong>.</p>
<p>We'll review your photos and get back to you within 24 hours with two offers — a cash offer and a higher store-credit offer.</p>
<p><a href=""{_frontendUrl}/trade-in/{requestId}"" style=""background-color: #6E0114; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"">View your request</a></p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(toEmail, subject, body);
}

public async Task SendTradeInOfferReadyAsync(string toEmail, string requestId, string brand, string model, decimal cashOffer, decimal creditOffer, DateTime expiresAt)
{
    if (!_isEnabled || string.IsNullOrEmpty(toEmail)) return;
    var subject = $"Your trade-in offer for the {brand} {model} is ready";
    var body = $@"
<h2>Your offer is ready</h2>
<p>We've reviewed your <strong>{brand} {model}</strong> and put together two offers:</p>
<ul>
    <li><strong>Cash:</strong> ${cashOffer:N2}</li>
    <li><strong>Store credit:</strong> ${creditOffer:N2} (higher value!)</li>
</ul>
<p>This offer expires on <strong>{expiresAt:MMMM d, yyyy}</strong>.</p>
<p><a href=""{_frontendUrl}/trade-in/{requestId}"" style=""background-color: #6E0114; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"">Review your offer</a></p>
<p style=""color: #666; font-size: 12px;"">Final offer subject to inspection. If condition differs, offer may be adjusted.</p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(toEmail, subject, body);
}

public async Task SendTradeInAcceptedShippingInstructionsAsync(string toEmail, string requestId, string brand, string model)
{
    if (!_isEnabled || string.IsNullOrEmpty(toEmail)) return;
    var subject = "Next steps: shipping your guitar";
    var body = $@"
<h2>Thanks for accepting!</h2>
<p>Here's what happens next:</p>
<ol>
    <li>We'll upload your prepaid shipping label within 1 business day.</li>
    <li>Pack your <strong>{brand} {model}</strong> securely (case + box, plenty of padding).</li>
    <li>Drop it off at the carrier indicated on the label.</li>
</ol>
<p><a href=""{_frontendUrl}/trade-in/{requestId}"" style=""background-color: #6E0114; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"">View shipping page</a></p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(toEmail, subject, body);
}

public async Task SendTradeInDeclinedAdminAsync(string brand, string model, string userEmail)
{
    if (!_isEnabled || string.IsNullOrEmpty(_sellerEmail)) return;
    var subject = $"Trade-in offer declined: {brand} {model}";
    var body = $@"
<h2>Offer Declined</h2>
<p>The user <strong>{userEmail}</strong> declined the offer for their <strong>{brand} {model}</strong>.</p>
<p>You can send a new offer if you want to try again.</p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(_sellerEmail, subject, body);
}

public async Task SendTradeInReceivedAsync(string toEmail, string requestId, string brand, string model)
{
    if (!_isEnabled || string.IsNullOrEmpty(toEmail)) return;
    var subject = "We got your guitar";
    var body = $@"
<h2>Your guitar arrived</h2>
<p>We received your <strong>{brand} {model}</strong> and are inspecting it now. We'll send you another update within 1–2 business days.</p>
<p><a href=""{_frontendUrl}/trade-in/{requestId}"">View your trade-in</a></p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(toEmail, subject, body);
}

public async Task SendTradeInPaymentSentAsync(string toEmail, string brand, string model, decimal amount, string? paypalTransactionId)
{
    if (!_isEnabled || string.IsNullOrEmpty(toEmail)) return;
    var subject = "Your trade-in payment is on the way";
    var txnLine = string.IsNullOrEmpty(paypalTransactionId)
        ? string.Empty
        : $"<p>PayPal transaction ID: <code>{paypalTransactionId}</code></p>";
    var body = $@"
<h2>Payment Sent</h2>
<p>We've sent <strong>${amount:N2}</strong> via PayPal for your <strong>{brand} {model}</strong>.</p>
{txnLine}
<p>Thanks for trading with us!</p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(toEmail, subject, body);
}

public async Task SendTradeInCreditIssuedAsync(string toEmail, string brand, string model, decimal amount, decimal newBalance)
{
    if (!_isEnabled || string.IsNullOrEmpty(toEmail)) return;
    var subject = "Your store credit is ready to spend";
    var body = $@"
<h2>Store Credit Available</h2>
<p>We've added <strong>${amount:N2}</strong> in store credit for your <strong>{brand} {model}</strong>. Your new balance is <strong>${newBalance:N2}</strong>.</p>
<p>Apply it at checkout next time you shop.</p>
<p><a href=""{_frontendUrl}/account/credit"" style=""background-color: #6E0114; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"">View credit balance</a></p>
<hr>
<p style=""color: #666; font-size: 12px;"">Luke's Guitar Shop</p>";
    await SendEmailAsync(toEmail, subject, body);
}
```

**Step 2: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/EmailService.cs
git commit -m "feat(trade-in): add 7 email templates for trade-in lifecycle"
```

---

## Task 6: User-facing TradeIns controller

**Files:**
- Create: `backend/GuitarDb.API/Controllers/TradeInsController.cs`

**Step 1: Write the controller**

The controller has these endpoints (all `[Authorize]`):
- `POST /api/trade-ins` (multipart) — submit
- `GET /api/trade-ins/me` — list current user's
- `GET /api/trade-ins/{id}` — get one (owner-only)
- `POST /api/trade-ins/{id}/accept` — accept active offer
- `POST /api/trade-ins/{id}/decline` — decline active offer

Photo handling mirrors `MessagesController.SendMessageWithImages` but stores files at `wwwroot/uploads/trade-ins/{requestId}/{guid}{ext}`. Limits: max 8 photos, 5MB each, 25MB total request.

```csharp
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
        var allowedConditions = new[] { "Excellent", "Very Good", "Good", "Fair" };
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
```

**Step 2: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 3: Smoke test via Swagger** *(skip if dev SMTP unconfigured — endpoints still work)*

Run: `cd backend/GuitarDb.API && dotnet run`. Visit `http://localhost:5000/swagger`. Authenticate with a JWT, hit `POST /api/trade-ins/me` to verify it returns `[]` for a new user. Stop the app.

**Step 4: Commit**

```bash
git add backend/GuitarDb.API/Controllers/TradeInsController.cs
git commit -m "feat(trade-in): add user-facing trade-ins controller"
```

---

## Task 7: Admin TradeIns controller

**Files:**
- Create: `backend/GuitarDb.API/Controllers/AdminTradeInsController.cs`

**Step 1: Write the controller**

Endpoints (all `[AdminAuthorize]`):
- `GET /api/admin/trade-ins?status=` — list
- `GET /api/admin/trade-ins/{id}` — detail (full, includes user email + paypal_email + all offers)
- `POST /api/admin/trade-ins/{id}/offer` — create new offer (status → Offered)
- `POST /api/admin/trade-ins/{id}/label` — multipart PDF upload
- `POST /api/admin/trade-ins/{id}/mark-received` — status → Received
- `POST /api/admin/trade-ins/{id}/mark-inspected` — status → Inspected, accepts notes
- `POST /api/admin/trade-ins/{id}/complete` — status → Completed, issues credit if credit-path
- `POST /api/admin/trade-ins/{id}/mark-paid` — cash path: stamp PaidAt + transaction id
- `POST /api/admin/trade-ins/{id}/cancel` — status → Cancelled

```csharp
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
```

**Step 2: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Controllers/AdminTradeInsController.cs
git commit -m "feat(trade-in): add admin trade-ins controller with full workflow"
```

---

## Task 8: Store credit controller + checkout integration

**Files:**
- Create: `backend/GuitarDb.API/Controllers/StoreCreditController.cs`
- Modify: `backend/GuitarDb.API/Models/Order.cs` (add 2 fields)
- Modify: `backend/GuitarDb.API/DTOs/CheckoutDtos.cs` (add `ApplyStoreCredit` to `CheckoutRequest`) — *first read the file to confirm path/name*
- Modify: `backend/GuitarDb.API/Controllers/CheckoutController.cs` (apply credit + debit on completion)

**Step 1: Read the existing checkout DTO**

Run: locate the existing checkout DTOs.
```
grep -nR "class CheckoutRequest" backend/GuitarDb.API/
```
Open whichever file declares `CheckoutRequest` and add a new property:

```csharp
public bool ApplyStoreCredit { get; set; } = false;
```

**Step 2: Update `Order.cs`**

Add these two properties to `Order` (after `TrackingNumber`):

```csharp
[BsonElement("store_credit_applied")]
[BsonIgnoreIfDefault]
public decimal StoreCreditApplied { get; set; } = 0;

[BsonElement("store_credit_id")]
[BsonRepresentation(BsonType.ObjectId)]
[BsonIgnoreIfNull]
public string? StoreCreditId { get; set; }
```

Add `using MongoDB.Bson.Serialization.Attributes;` if not already present (it is).

**Step 3: Create the store-credit controller**

```csharp
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
```

**Step 4: Modify `CheckoutController.CreateCheckoutSession`**

After the existing `lineItems` are computed and **before** `StripeConfiguration.ApiKey = ...`, insert:

```csharp
// Apply store credit if requested
decimal storeCreditApplied = 0;
string? storeCreditId = null;
if (request.ApplyStoreCredit && userId != null)
{
    var sc = await _mongoDbService.GetStoreCreditByUserAsync(userId);
    if (sc != null && sc.Balance > 0)
    {
        var subtotal = lineItems.Sum(li => (li.PriceData?.UnitAmount ?? 0) * (li.Quantity ?? 1)) / 100m;
        storeCreditApplied = Math.Min(sc.Balance, subtotal);
        storeCreditId = sc.Id;
    }
}
```

Then, when building `options.Metadata`, add:

```csharp
{ "store_credit_applied", storeCreditApplied.ToString("F2") },
{ "store_credit_id", storeCreditId ?? "" },
```

And add a Stripe coupon-equivalent: a discount line item won't work simply — instead, use the `Discounts` field with a one-off coupon, OR (simpler) reduce `UnitAmount` of the first line item by the credit amount. **Use the simpler approach**: subtract `storeCreditApplied` from the first line item's `UnitAmount` (in cents), clamped at 0:

```csharp
if (storeCreditApplied > 0 && lineItems.Count > 0)
{
    var creditCents = (long)(storeCreditApplied * 100);
    var first = lineItems[0];
    var newAmount = (first.PriceData!.UnitAmount ?? 0) - creditCents;
    if (newAmount < 0) newAmount = 0;
    first.PriceData.UnitAmount = newAmount;
    // Reflect the discount in the product name so the user sees it on Stripe's checkout
    first.PriceData.ProductData.Description =
        $"{first.PriceData.ProductData.Description} (store credit -${storeCreditApplied:N2})";
}
```

**Step 5: Modify `CheckoutController.CompleteCheckout`**

After the order is built but before `await _mongoDbService.CreateOrderAsync(order);`, parse the metadata back out and debit the credit:

```csharp
session.Metadata.TryGetValue("store_credit_applied", out var creditAppliedStr);
session.Metadata.TryGetValue("store_credit_id", out var creditIdStr);
decimal.TryParse(creditAppliedStr, out var creditApplied);
order.StoreCreditApplied = creditApplied;
order.StoreCreditId = string.IsNullOrEmpty(creditIdStr) ? null : creditIdStr;

if (creditApplied > 0 && userId != null)
{
    var ok = await _mongoDbService.DebitUserStoreCreditAsync(
        userId, creditApplied, $"order {order.StripeSessionId}", null);
    if (!ok)
    {
        _logger.LogWarning("Store credit debit failed for user {User} amount {Amount}", userId, creditApplied);
        // Continue anyway — order should still go through; we'll reconcile manually.
    }
}
```

(The PayPal completion path can be patched in a follow-up; spec says full integration but Stripe is the primary flow and PayPal-specific store-credit can ship next.)

**Step 6: Build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: 0 errors.

**Step 7: Commit**

```bash
git add backend/GuitarDb.API/Controllers/StoreCreditController.cs backend/GuitarDb.API/Models/Order.cs backend/GuitarDb.API/Controllers/CheckoutController.cs backend/GuitarDb.API/DTOs/
git commit -m "feat(store-credit): integrate store credit into Stripe checkout"
```

---

## Task 9: Frontend types + API client functions

**Files:**
- Create: `frontend/lib/types/trade-in.ts`
- Create: `frontend/lib/types/store-credit.ts`
- Modify: `frontend/lib/api.ts`

**Step 1: Create trade-in types**

```typescript
// frontend/lib/types/trade-in.ts
export type TradeInCondition = 'Excellent' | 'Very Good' | 'Good' | 'Fair';

export type TradeInStatus =
  | 'submitted' | 'offered' | 'accepted' | 'declined' | 'expired'
  | 'received' | 'inspected' | 'completed' | 'cancelled';

export interface TradeInPhoto { url: string; }

export interface TradeInOffer {
  cashOffer: number;
  storeCreditOffer: number;
  expiresAt: string;
  acceptedType?: 'cash' | 'credit' | null;
  acceptedAt?: string | null;
  declinedAt?: string | null;
  isExpired: boolean;
}

export interface TradeInShipping {
  labelUrl?: string | null;
  receivedAt?: string | null;
  inspectedAt?: string | null;
}

export interface TradeInPayout {
  completedAt?: string | null;
  paidAt?: string | null;
}

export interface TradeInRequestDto {
  id: string;
  brand: string;
  model: string;
  condition: TradeInCondition;
  notes: string;
  status: TradeInStatus;
  photos: TradeInPhoto[];
  activeOffer?: TradeInOffer | null;
  shipping?: TradeInShipping | null;
  payout?: TradeInPayout | null;
  createdAt: string;
}

export interface AdminTradeInListItem {
  id: string;
  email: string;
  brand: string;
  model: string;
  condition: string;
  status: TradeInStatus;
  createdAt: string;
}

export interface AdminTradeInDetail extends TradeInRequestDto {
  email: string;
  userId: string;
  allOffers: TradeInOffer[];
  paypalEmail?: string | null;
  paypalTransactionId?: string | null;
  inspectionNotes?: string | null;
}
```

**Step 2: Create store-credit types**

```typescript
// frontend/lib/types/store-credit.ts
export interface StoreCreditEntry {
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  createdAt: string;
}

export interface StoreCreditDto {
  balance: number;
  history: StoreCreditEntry[];
}
```

**Step 3: Add API functions to `frontend/lib/api.ts`**

Append at the end of the file (before `export default api;`):

```typescript
// Trade-in API
import type { TradeInRequestDto, AdminTradeInListItem, AdminTradeInDetail } from './types/trade-in';
import type { StoreCreditDto } from './types/store-credit';

export async function submitTradeIn(formData: FormData): Promise<{ id: string }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${API_BASE_URL}/trade-ins`, {
    method: 'POST',
    body: formData,
    headers,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw { message: errBody.error || 'Submit failed', status: response.status } as ApiError;
  }
  return response.json();
}

export async function getMyTradeIns(): Promise<TradeInRequestDto[]> {
  return api.authGet<TradeInRequestDto[]>('/trade-ins/me');
}

export async function getTradeIn(id: string): Promise<TradeInRequestDto> {
  return api.authGet<TradeInRequestDto>(`/trade-ins/${id}`);
}

export async function acceptTradeInOffer(id: string, type: 'cash' | 'credit', paypalEmail?: string): Promise<TradeInRequestDto> {
  return api.authPost<TradeInRequestDto>(`/trade-ins/${id}/accept`, { type, paypalEmail });
}

export async function declineTradeInOffer(id: string): Promise<TradeInRequestDto> {
  return api.authPost<TradeInRequestDto>(`/trade-ins/${id}/decline`);
}

// Admin trade-in API
export async function getAdminTradeIns(status?: string): Promise<AdminTradeInListItem[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return api.authGet<AdminTradeInListItem[]>(`/admin/trade-ins${qs}`);
}

export async function getAdminTradeIn(id: string): Promise<AdminTradeInDetail> {
  return api.authGet<AdminTradeInDetail>(`/admin/trade-ins/${id}`);
}

export async function adminCreateTradeInOffer(id: string, cashOffer: number, storeCreditOffer: number, expirationDays: number): Promise<{ id: string }> {
  return api.authPost(`/admin/trade-ins/${id}/offer`, { cashOffer, storeCreditOffer, expirationDays });
}

export async function adminUploadTradeInLabel(id: string, file: File): Promise<{ labelUrl: string }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const fd = new FormData();
  fd.append('label', file);
  const response = await fetch(`${API_BASE_URL}/admin/trade-ins/${id}/label`, {
    method: 'POST', body: fd, headers,
  });
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw { message: errBody.error || 'Upload failed', status: response.status } as ApiError;
  }
  return response.json();
}

export async function adminMarkTradeInReceived(id: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/mark-received`);
}

export async function adminMarkTradeInInspected(id: string, notes?: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/mark-inspected`, { notes });
}

export async function adminCompleteTradeIn(id: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/complete`);
}

export async function adminMarkTradeInPaid(id: string, paypalTransactionId?: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/mark-paid`, { paypalTransactionId });
}

export async function adminCancelTradeIn(id: string): Promise<void> {
  await api.authPost(`/admin/trade-ins/${id}/cancel`);
}

// Store credit API
export async function getMyStoreCredit(): Promise<StoreCreditDto> {
  return api.authGet<StoreCreditDto>('/store-credit/me');
}
```

**Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: 0 errors.

**Step 5: Commit**

```bash
git add frontend/lib/types/trade-in.ts frontend/lib/types/store-credit.ts frontend/lib/api.ts
git commit -m "feat(trade-in): add frontend types and API client functions"
```

---

## Task 10: Public landing page `/trade-in`

**Files:**
- Create: `frontend/app/trade-in/page.tsx`

**Step 1: Build the page**

Static landing page, server component. Trust section, 3-step explainer, CTA.

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Clock, Shield, Zap } from 'lucide-react';

export const metadata = { title: 'Trade in your guitar — Luke\'s Guitar Shop' };

export default function TradeInLandingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="text-center py-16">
        <h1 className="text-4xl md:text-5xl font-bold text-[#020E1C] mb-4">
          Trade in your guitar online
        </h1>
        <p className="text-xl text-gray-600 mb-8">Get a quote within 24 hours</p>
        <Link href="/trade-in/submit">
          <Button className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-6 text-lg">
            Start Trade-In
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 text-center">
          <Clock className="h-10 w-10 mx-auto text-[#6E0114] mb-3" />
          <h3 className="font-semibold text-[#020E1C] mb-2">24 hour quote</h3>
          <p className="text-gray-600 text-sm">We review your photos and send two offers within a day.</p>
        </div>
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 text-center">
          <Shield className="h-10 w-10 mx-auto text-[#6E0114] mb-3" />
          <h3 className="font-semibold text-[#020E1C] mb-2">Trusted shop</h3>
          <p className="text-gray-600 text-sm">Hundreds of guitars sold on Reverb and eBay with 5-star feedback.</p>
        </div>
        <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6 text-center">
          <Zap className="h-10 w-10 mx-auto text-[#6E0114] mb-3" />
          <h3 className="font-semibold text-[#020E1C] mb-2">Higher with credit</h3>
          <p className="text-gray-600 text-sm">Pick cash or take a higher offer in store credit.</p>
        </div>
      </div>

      <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-8 mb-16">
        <h2 className="text-2xl font-bold text-[#020E1C] mb-6 text-center">How it works</h2>
        <ol className="space-y-6 max-w-2xl mx-auto">
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#6E0114] text-white flex items-center justify-center font-bold">1</span>
            <div>
              <h3 className="font-semibold text-[#020E1C]">Submit your guitar</h3>
              <p className="text-gray-600">Tell us the brand, model, and condition. Upload a few photos from your phone.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#6E0114] text-white flex items-center justify-center font-bold">2</span>
            <div>
              <h3 className="font-semibold text-[#020E1C]">Pick your offer</h3>
              <p className="text-gray-600">We'll email you two offers — cash or a higher amount in store credit. You choose.</p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex-shrink-0 w-10 h-10 rounded-full bg-[#6E0114] text-white flex items-center justify-center font-bold">3</span>
            <div>
              <h3 className="font-semibold text-[#020E1C]">Ship for free</h3>
              <p className="text-gray-600">We send a prepaid label. You ship. We pay (or credit) you after inspection.</p>
            </div>
          </li>
        </ol>
      </div>

      <div className="text-center pb-16">
        <Link href="/trade-in/submit">
          <Button className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-6 text-lg">
            Start Trade-In
          </Button>
        </Link>
      </div>
    </div>
  );
}
```

**Step 2: Type-check + visual smoke test**

Run: `cd frontend && npx tsc --noEmit` — Expected: clean.
Run: `cd frontend && npm run dev`. Visit `http://localhost:3000/trade-in`. Stop the dev server.

**Step 3: Commit**

```bash
git add frontend/app/trade-in/page.tsx
git commit -m "feat(trade-in): add public landing page"
```

---

## Task 11: Submission form `/trade-in/submit`

**Files:**
- Create: `frontend/app/trade-in/submit/page.tsx`

**Step 1: Build the page**

Login-gated client component. Mirror the `app/checkout/page.tsx` pattern for the "sign in required" stub. Form fields: brand, model, condition (select), notes (textarea), multi-file photo upload.

```tsx
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn, Upload, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { submitTradeIn } from '@/lib/api';
import type { TradeInCondition } from '@/lib/types/trade-in';

const CONDITIONS: TradeInCondition[] = ['Excellent', 'Very Good', 'Good', 'Fair'];

export default function TradeInSubmitPage() {
  const router = useRouter();
  const { isAuthenticated, setShowLoginModal, setShowRegisterModal } = useAuth();
  const { showToast } = useToast();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [condition, setCondition] = useState<TradeInCondition>('Excellent');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <LogIn className="w-24 h-24 mx-auto text-gray-300 mb-6" />
        <h1 className="text-2xl font-bold text-[#020E1C] mb-4">Sign In Required</h1>
        <p className="text-gray-600 mb-8">Please sign in or create an account to submit a trade-in.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={() => setShowLoginModal(true)} className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-4">Sign In</Button>
          <Button onClick={() => setShowRegisterModal(true)} variant="outline" className="font-semibold px-8 py-4">Create Account</Button>
        </div>
      </div>
    );
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).slice(0, 8 - photos.length);
    setPhotos((prev) => [...prev, ...next].slice(0, 8));
  };

  const removePhoto = (idx: number) => setPhotos((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brand.trim() || !model.trim()) {
      showToast('Please fill in brand and model', 'error');
      return;
    }
    if (photos.length === 0) {
      showToast('Please add at least one photo', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('Brand', brand.trim());
      fd.append('Model', model.trim());
      fd.append('Condition', condition);
      fd.append('Notes', notes.trim());
      photos.forEach((p) => fd.append('Photos', p));
      const result = await submitTradeIn(fd);
      router.push(`/trade-in/${result.id}/submitted`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Submit failed';
      showToast(message, 'error');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/trade-in" className="inline-flex items-center text-gray-600 hover:text-[#020E1C] mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Link>
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">Tell us about your guitar</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Gibson, Fender, Martin..." required />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Les Paul Standard, Stratocaster..." required />
        </div>
        <div>
          <Label htmlFor="condition">Condition</Label>
          <select id="condition" value={condition} onChange={(e) => setCondition(e.target.value as TradeInCondition)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#6E0114]">
            {CONDITIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any modifications, issues, or details we should know about?" rows={4}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6E0114]" />
        </div>
        <div>
          <Label>Photos (up to 8, 5MB each)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(p)} alt={`photo ${i + 1}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {photos.length < 8 && (
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-500 hover:border-[#6E0114] hover:text-[#6E0114]">
                <Upload className="h-6 w-6" /><span className="text-xs">Add photo</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
        </div>
        <Button type="submit" disabled={submitting} className="w-full bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold py-6 text-lg disabled:opacity-50">
          {submitting ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Submitting...</> : 'Submit for review'}
        </Button>
      </form>
    </div>
  );
}
```

**Step 2: Confirm `Label` component exists**

Check `frontend/components/ui/label.tsx`. If it doesn't exist, replace `<Label>...</Label>` usages with `<label className="block text-sm font-medium text-gray-700 mb-1">...</label>`.

**Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

**Step 4: Commit**

```bash
git add frontend/app/trade-in/submit/page.tsx
git commit -m "feat(trade-in): add submission form with photo upload"
```

---

## Task 12: Submission confirmation page

**Files:**
- Create: `frontend/app/trade-in/[id]/submitted/page.tsx`

**Step 1: Write the page**

```tsx
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default async function SubmittedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-xl mx-auto text-center py-16 px-4">
      <CheckCircle2 className="w-20 h-20 mx-auto text-green-600 mb-6" />
      <h1 className="text-3xl font-bold text-[#020E1C] mb-4">Thanks — we got it</h1>
      <p className="text-gray-600 mb-8">
        We'll email you within 24 hours with two offers: a cash offer and a higher store-credit offer.
      </p>
      <Link href={`/trade-in/${id}`} className="inline-block bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3] font-semibold px-8 py-4 rounded-lg">
        View your request
      </Link>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add frontend/app/trade-in/[id]/submitted/page.tsx
git commit -m "feat(trade-in): add submission confirmation page"
```

---

## Task 13: Offer / shipping page `/trade-in/[id]`

**Files:**
- Create: `frontend/app/trade-in/[id]/page.tsx`

**Step 1: Build the page**

Single client page that renders different views based on `status`:
- `submitted` → "We're reviewing your guitar"
- `offered` (with active, unexpired offer) → cash + credit cards, accept/decline buttons
- `accepted` → shipping instructions + label download (or "label coming soon" if not yet uploaded)
- `received` → "we got it, inspecting now"
- `inspected` → "inspection complete, payout coming"
- `completed` → "all done"
- `declined`, `expired`, `cancelled` → terminal message

```tsx
'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Package, CheckCircle2, XCircle, Clock, Download } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { getTradeIn, acceptTradeInOffer, declineTradeInOffer } from '@/lib/api';
import type { TradeInRequestDto } from '@/lib/types/trade-in';

function formatPrice(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);
}

export default function TradeInDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<TradeInRequestDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptType, setAcceptType] = useState<'cash' | 'credit' | null>(null);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getTradeIn(id).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [id, isAuthenticated]);

  if (!isAuthenticated) {
    return <div className="max-w-2xl mx-auto text-center py-16 px-4"><h1 className="text-2xl font-bold mb-4">Sign in to view your trade-in</h1></div>;
  }
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!data) return <div className="text-center py-16">Trade-in not found.</div>;

  const handleAcceptCash = async () => {
    if (!paypalEmail.trim()) { showToast('PayPal email required', 'error'); return; }
    setActing(true);
    try {
      const updated = await acceptTradeInOffer(id, 'cash', paypalEmail.trim());
      setData(updated); setAcceptType(null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setActing(false); }
  };
  const handleAcceptCredit = async () => {
    setActing(true);
    try {
      const updated = await acceptTradeInOffer(id, 'credit');
      setData(updated); setAcceptType(null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setActing(false); }
  };
  const handleDecline = async () => {
    if (!confirm('Decline this offer?')) return;
    setActing(true);
    try { setData(await declineTradeInOffer(id)); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setActing(false); }
  };

  const offer = data.activeOffer;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link href="/account/trade-ins" className="inline-flex items-center text-gray-600 hover:text-[#020E1C] mb-6">
        <ArrowLeft className="h-4 w-4 mr-2" />My trade-ins
      </Link>
      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">{data.brand} {data.model}</h1>
      <p className="text-gray-600 mb-6">{data.condition} · Submitted {new Date(data.createdAt).toLocaleDateString()}</p>

      {data.photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {data.photos.map((p, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <Image src={p.url} alt={`photo ${i + 1}`} fill sizes="200px" className="object-cover" />
            </div>
          ))}
        </div>
      )}

      {/* Status-specific body */}
      {data.status === 'submitted' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <Clock className="h-8 w-8 text-blue-600 mb-2" />
          <h2 className="text-xl font-semibold mb-2">Under review</h2>
          <p className="text-gray-700">We'll email you within 24 hours.</p>
        </div>
      )}

      {data.status === 'offered' && offer && !offer.isExpired && !offer.acceptedAt && !offer.declinedAt && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your offer</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-6">
              <h3 className="font-medium text-gray-700 mb-1">Cash offer</h3>
              <p className="text-3xl font-bold text-[#020E1C] mb-4">{formatPrice(offer.cashOffer)}</p>
              <p className="text-sm text-gray-600 mb-4">Paid via PayPal after inspection.</p>
              <Button onClick={() => setAcceptType('cash')} disabled={acting} className="w-full bg-[#020E1C] hover:bg-black text-white">Accept cash</Button>
            </div>
            <div className="bg-red-50 border-2 border-[#6E0114] rounded-lg p-6 relative">
              <span className="absolute top-2 right-2 bg-[#6E0114] text-white text-xs font-bold px-2 py-1 rounded">BETTER VALUE</span>
              <h3 className="font-medium text-gray-700 mb-1">Store credit</h3>
              <p className="text-3xl font-bold text-[#6E0114] mb-4">{formatPrice(offer.storeCreditOffer)}</p>
              <p className="text-sm text-gray-600 mb-4">Spend it on anything in the shop. Credit issued after inspection.</p>
              <Button onClick={handleAcceptCredit} disabled={acting} className="w-full bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">{acting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Accept credit'}</Button>
            </div>
          </div>
          <p className="text-xs text-gray-500">Offer expires {new Date(offer.expiresAt).toLocaleDateString()}. Final offer subject to inspection.</p>
          <Button onClick={handleDecline} disabled={acting} variant="outline">Decline both</Button>

          {acceptType === 'cash' && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
              <label className="block text-sm font-medium mb-2">Your PayPal email</label>
              <input type="email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className="w-full border rounded px-3 py-2 mb-3" />
              <div className="flex gap-2">
                <Button onClick={handleAcceptCash} disabled={acting} className="bg-[#020E1C] text-white">Confirm</Button>
                <Button onClick={() => setAcceptType(null)} variant="outline">Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {data.status === 'offered' && offer && offer.isExpired && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Offer expired</h2>
          <p>This offer has expired. Email us if you'd like a new one.</p>
        </div>
      )}

      {data.status === 'accepted' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
          <Package className="h-8 w-8 text-green-700" />
          <h2 className="text-xl font-semibold">Ship it our way</h2>
          {data.shipping?.labelUrl ? (
            <a href={data.shipping.labelUrl} target="_blank" rel="noopener" className="inline-flex items-center bg-[#6E0114] text-[#FFFFF3] px-6 py-3 rounded-lg font-semibold">
              <Download className="h-4 w-4 mr-2" />Download prepaid label (PDF)
            </a>
          ) : (
            <p className="text-gray-700">We'll upload your prepaid label within 1 business day. Check back shortly.</p>
          )}
          <div className="bg-white rounded p-4 border">
            <h3 className="font-semibold mb-2">Packing checklist</h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              <li>Use a hardshell or gig case if available</li>
              <li>Wrap with bubble wrap, especially headstock</li>
              <li>Use a sturdy double-walled box</li>
              <li>Loosen the strings before shipping</li>
              <li>Drop off at the carrier on the label</li>
            </ul>
          </div>
        </div>
      )}

      {data.status === 'received' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <CheckCircle2 className="h-8 w-8 text-blue-600 mb-2" />
          <h2 className="text-xl font-semibold mb-2">We got your guitar</h2>
          <p>Inspecting now. We'll update you within 1–2 business days.</p>
        </div>
      )}

      {data.status === 'inspected' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Inspection complete</h2>
          <p>Your payout is being processed.</p>
        </div>
      )}

      {data.status === 'completed' && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <CheckCircle2 className="h-8 w-8 text-green-700 mb-2" />
          <h2 className="text-xl font-semibold mb-2">All done</h2>
          {offer?.acceptedType === 'credit' ? (
            <p>Your store credit has been added. <Link href="/account/credit" className="text-[#6E0114] underline">View balance</Link></p>
          ) : (
            <p>Your PayPal payment has been sent. Thanks for trading!</p>
          )}
        </div>
      )}

      {(data.status === 'declined' || data.status === 'expired' || data.status === 'cancelled') && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <XCircle className="h-8 w-8 text-gray-500 mb-2" />
          <h2 className="text-xl font-semibold mb-2 capitalize">{data.status}</h2>
          <p>This trade-in is closed.</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

**Step 3: Commit**

```bash
git add frontend/app/trade-in/[id]/page.tsx
git commit -m "feat(trade-in): add user offer/shipping page with accept/decline"
```

---

## Task 14: Account history + credit pages

**Files:**
- Create: `frontend/app/account/trade-ins/page.tsx`
- Create: `frontend/app/account/credit/page.tsx`

**Step 1: Write the trade-ins history page**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyTradeIns } from '@/lib/api';
import type { TradeInRequestDto } from '@/lib/types/trade-in';

export default function MyTradeInsPage() {
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<TradeInRequestDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getMyTradeIns().then(setItems).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div className="text-center py-16">Sign in to view your trade-ins.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">My trade-ins</h1>
      {items.length === 0 ? (
        <p className="text-gray-600">You haven't submitted any trade-ins yet. <Link href="/trade-in" className="text-[#6E0114] underline">Start one</Link>.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <Link key={item.id} href={`/trade-in/${item.id}`}
              className="flex items-center justify-between bg-[#FFFFF3] border border-gray-200 rounded-lg p-4 hover:border-[#6E0114]">
              <div>
                <h2 className="font-semibold text-[#020E1C]">{item.brand} {item.model}</h2>
                <p className="text-sm text-gray-600 capitalize">{item.status} · {new Date(item.createdAt).toLocaleDateString()}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Write the credit page**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getMyStoreCredit } from '@/lib/api';
import type { StoreCreditDto } from '@/lib/types/store-credit';

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

export default function StoreCreditPage() {
  const { isAuthenticated } = useAuth();
  const [data, setData] = useState<StoreCreditDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    getMyStoreCredit().then(setData).finally(() => setLoading(false));
  }, [isAuthenticated]);

  if (!isAuthenticated) return <div className="text-center py-16">Sign in to view your store credit.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">Store credit</h1>
      <div className="bg-[#FFFFF3] border-2 border-[#6E0114] rounded-lg p-8 text-center mb-8">
        <p className="text-sm text-gray-600 mb-2">Available balance</p>
        <p className="text-5xl font-bold text-[#6E0114]">{formatPrice(data?.balance || 0)}</p>
      </div>
      <h2 className="text-xl font-semibold mb-3">History</h2>
      {data && data.history.length > 0 ? (
        <div className="space-y-2">
          {data.history.map((entry, i) => (
            <div key={i} className="flex justify-between bg-white border border-gray-200 rounded p-3">
              <div>
                <p className="capitalize text-sm font-medium">{entry.reason}</p>
                <p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <p className={`font-semibold ${entry.type === 'credit' ? 'text-green-700' : 'text-gray-700'}`}>
                {entry.type === 'credit' ? '+' : '-'}{formatPrice(entry.amount)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600">No activity yet.</p>
      )}
    </div>
  );
}
```

**Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

**Step 4: Commit**

```bash
git add frontend/app/account/trade-ins/page.tsx frontend/app/account/credit/page.tsx
git commit -m "feat(trade-in): add user account pages for trade-ins and store credit"
```

---

## Task 15: Admin list page `/admin/trade-ins`

**Files:**
- Create: `frontend/app/admin/trade-ins/page.tsx`

**Step 1: Build the page**

```tsx
'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminTradeIns } from '@/lib/api';
import type { AdminTradeInListItem, TradeInStatus } from '@/lib/types/trade-in';

const STATUS_FILTERS: (TradeInStatus | 'all')[] = ['all','submitted','offered','accepted','received','inspected','completed','declined','expired','cancelled'];

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  offered: 'bg-purple-100 text-purple-800',
  accepted: 'bg-green-100 text-green-800',
  received: 'bg-yellow-100 text-yellow-800',
  inspected: 'bg-orange-100 text-orange-800',
  completed: 'bg-gray-200 text-gray-800',
  declined: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-gray-100 text-gray-700',
};

export default function AdminTradeInsListPage() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<AdminTradeInListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<TradeInStatus | 'all'>('all');

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    getAdminTradeIns(status === 'all' ? undefined : status).then(setItems).finally(() => setLoading(false));
  }, [isAdmin, status]);

  if (!isAdmin) return <div className="text-center py-16">Admin access required.</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-[#020E1C] mb-6">Trade-ins</h1>
      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_FILTERS.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1 text-sm rounded ${status === s ? 'bg-[#6E0114] text-[#FFFFF3]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-gray-600">No trade-ins {status !== 'all' && `with status "${status}"`}.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-600">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Guitar</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(it => (
                <tr key={it.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">{it.email}</td>
                  <td className="px-4 py-3 text-sm font-medium">{it.brand} {it.model}</td>
                  <td className="px-4 py-3"><span className={`text-xs font-medium px-2 py-0.5 rounded ${statusColors[it.status] || 'bg-gray-100'}`}>{it.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(it.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right"><Link href={`/admin/trade-ins/${it.id}`} className="inline-flex items-center text-[#6E0114] hover:underline text-sm">Open <ArrowRight className="h-4 w-4 ml-1" /></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/app/admin/trade-ins/page.tsx
git commit -m "feat(trade-in): add admin list page"
```

---

## Task 16: Admin detail page

**Files:**
- Create: `frontend/app/admin/trade-ins/[id]/page.tsx`

**Step 1: Build the page**

Single client component with sections:
1. Submission info (brand, model, condition, notes, photos, user email)
2. Active offer info (if any) — current state + accept history
3. Send-offer form (cash, credit, expiration days)
4. Status actions toolbar — Mark Received, Mark Inspected, Complete, Mark Paid, Cancel — visible based on current status
5. Label upload (PDF input)

```tsx
'use client';
import { useEffect, useState, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Upload, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import {
  getAdminTradeIn, adminCreateTradeInOffer, adminUploadTradeInLabel,
  adminMarkTradeInReceived, adminMarkTradeInInspected, adminCompleteTradeIn,
  adminMarkTradeInPaid, adminCancelTradeIn
} from '@/lib/api';
import type { AdminTradeInDetail } from '@/lib/types/trade-in';

function formatPrice(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

export default function AdminTradeInDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [data, setData] = useState<AdminTradeInDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [cashOffer, setCashOffer] = useState('');
  const [creditOffer, setCreditOffer] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [paypalTxn, setPaypalTxn] = useState('');

  const reload = async () => setData(await getAdminTradeIn(id));

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return; }
    reload().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAdmin]);

  if (!isAdmin) return <div className="text-center py-16">Admin access required.</div>;
  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!data) return <div className="text-center py-16">Not found.</div>;

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await reload(); }
    catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  const handleSendOffer = () => wrap(async () => {
    const c = parseFloat(cashOffer); const sc = parseFloat(creditOffer); const d = parseInt(expirationDays, 10);
    if (isNaN(c) || isNaN(sc) || isNaN(d)) { showToast('Enter valid numbers', 'error'); return; }
    await adminCreateTradeInOffer(id, c, sc, d);
    showToast('Offer sent', 'success');
    setCashOffer(''); setCreditOffer('');
  });

  const handleLabelUpload = (file: File | null) => {
    if (!file) return;
    wrap(async () => { await adminUploadTradeInLabel(id, file); showToast('Label uploaded', 'success'); });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin/trade-ins" className="inline-flex items-center text-gray-600 mb-4"><ArrowLeft className="h-4 w-4 mr-2" />All trade-ins</Link>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#020E1C]">{data.brand} {data.model}</h1>
          <p className="text-gray-600">{data.condition} · {data.email} · <span className="capitalize font-medium">{data.status}</span></p>
        </div>
      </div>

      {data.notes && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm">
          <strong>Notes from user:</strong> {data.notes}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {data.photos.map((p, i) => (
          <a key={i} href={p.url} target="_blank" rel="noopener" className="relative aspect-square rounded overflow-hidden bg-gray-100 block">
            <Image src={p.url} alt={`photo ${i + 1}`} fill sizes="200px" className="object-cover" />
          </a>
        ))}
      </div>

      {/* Active offer summary */}
      {data.activeOffer && (
        <div className="bg-[#FFFFF3] border border-gray-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-2">Active offer</h2>
          <p>Cash: {formatPrice(data.activeOffer.cashOffer)} · Credit: {formatPrice(data.activeOffer.storeCreditOffer)} · Expires {new Date(data.activeOffer.expiresAt).toLocaleDateString()}</p>
          {data.activeOffer.acceptedType && <p className="mt-1">Accepted as <strong>{data.activeOffer.acceptedType}</strong> on {new Date(data.activeOffer.acceptedAt!).toLocaleString()}</p>}
          {data.paypalEmail && <p className="mt-1">User PayPal: <code>{data.paypalEmail}</code></p>}
          {data.activeOffer.declinedAt && <p className="mt-1 text-red-700">Declined on {new Date(data.activeOffer.declinedAt).toLocaleString()}</p>}
          {data.activeOffer.isExpired && <p className="mt-1 text-yellow-700">Offer expired without action</p>}
        </div>
      )}

      {/* Send offer form (always shown so admin can re-offer) */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
        <h2 className="font-semibold mb-3">Send {data.allOffers.length > 0 ? 'new ' : ''}offer</h2>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-600 mb-1">Cash $</label>
            <input type="number" step="0.01" value={cashOffer} onChange={e => setCashOffer(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Credit $</label>
            <input type="number" step="0.01" value={creditOffer} onChange={e => setCreditOffer(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
          <div>
            <label className="block text-xs text-gray-600 mb-1">Expires (days)</label>
            <input type="number" value={expirationDays} onChange={e => setExpirationDays(e.target.value)} className="w-full border rounded px-2 py-1" />
          </div>
        </div>
        <Button onClick={handleSendOffer} disabled={busy} className="mt-3 bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">Send offer</Button>
      </div>

      {/* Shipping section — visible after acceptance */}
      {(data.status === 'accepted' || data.status === 'received' || data.status === 'inspected' || data.status === 'completed') && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <h2 className="font-semibold mb-3">Shipping & inspection</h2>
          {data.shipping?.labelUrl ? (
            <p className="text-sm mb-2">Label: <a href={data.shipping.labelUrl} target="_blank" rel="noopener" className="text-[#6E0114] underline inline-flex items-center">View PDF <ExternalLink className="h-3 w-3 ml-1" /></a></p>
          ) : (
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm border border-dashed rounded p-3 mb-3">
              <Upload className="h-4 w-4" />Upload label PDF
              <input type="file" accept="application/pdf" className="hidden" onChange={e => handleLabelUpload(e.target.files?.[0] ?? null)} />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            {data.status === 'accepted' && <Button onClick={() => wrap(async () => { await adminMarkTradeInReceived(id); })} disabled={busy} variant="outline">Mark Received</Button>}
            {data.status === 'received' && (
              <>
                <input type="text" value={inspectionNotes} onChange={e => setInspectionNotes(e.target.value)} placeholder="Inspection notes (optional)" className="border rounded px-2 py-1 flex-1" />
                <Button onClick={() => wrap(async () => { await adminMarkTradeInInspected(id, inspectionNotes); setInspectionNotes(''); })} disabled={busy} variant="outline">Mark Inspected</Button>
              </>
            )}
            {data.status === 'inspected' && <Button onClick={() => wrap(async () => { await adminCompleteTradeIn(id); })} disabled={busy} className="bg-green-700 text-white hover:bg-green-800">Complete</Button>}
            {data.status === 'completed' && data.activeOffer?.acceptedType === 'cash' && !data.payout?.paidAt && (
              <>
                <input type="text" value={paypalTxn} onChange={e => setPaypalTxn(e.target.value)} placeholder="PayPal txn ID" className="border rounded px-2 py-1 flex-1" />
                <Button onClick={() => wrap(async () => { await adminMarkTradeInPaid(id, paypalTxn); setPaypalTxn(''); })} disabled={busy} className="bg-green-700 text-white">Mark Paid</Button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Cancel escape hatch */}
      {data.status !== 'completed' && data.status !== 'cancelled' && (
        <Button onClick={() => { if (confirm('Cancel this trade-in?')) wrap(async () => { await adminCancelTradeIn(id); }); }}
          disabled={busy} variant="outline" className="text-red-700 border-red-300">Cancel trade-in</Button>
      )}
    </div>
  );
}
```

**Step 2: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/app/admin/trade-ins/[id]/page.tsx
git commit -m "feat(trade-in): add admin detail page with full workflow actions"
```

---

## Task 17: Add nav link to admin Trade-Ins

**Files:**
- Modify: existing admin layout / nav (find with `grep`)

**Step 1: Find the admin nav**

Run: `grep -rn "Deal Finder\|adminTab\|admin/page" frontend/app/admin frontend/components 2>/dev/null | head -20`

Most likely the existing tabs live inside `frontend/app/admin/page.tsx`. Add a Link in the top nav of that page (or wherever the admin header lives) pointing to `/admin/trade-ins`. Keep it simple — a header link, not a new tab inside the dashboard's existing tab system.

If there's an `AdminLayout` or `AdminHeader` component, edit that. Otherwise add a `<Link href="/admin/trade-ins" className="...">Trade-Ins</Link>` near the existing admin h1 / nav area.

**Step 2: Type-check + visual check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/app/admin/page.tsx   # or whichever file you edited
git commit -m "feat(trade-in): link Trade-Ins admin page from admin nav"
```

---

## Task 18: Cart + checkout store-credit toggle

**Files:**
- Modify: `frontend/app/checkout/page.tsx`
- Optional: `frontend/app/cart/page.tsx` (a small "you have $X store credit" hint with a link to checkout)

**Step 1: In `checkout/page.tsx`, fetch user's balance on mount**

Add a new state + effect alongside the existing ones:

```tsx
import { getMyStoreCredit } from '@/lib/api';
// ...
const [creditBalance, setCreditBalance] = useState(0);
const [applyCredit, setApplyCredit] = useState(false);
useEffect(() => {
  if (!isAuthenticated) return;
  getMyStoreCredit().then(d => setCreditBalance(d.balance)).catch(() => {});
}, [isAuthenticated]);
```

**Step 2: Compute the applied amount (clamp to subtotal)**

Just below the existing `subtotal` calculation:

```tsx
const creditApplied = applyCredit ? Math.min(creditBalance, subtotal) : 0;
const totalAfterCredit = paymentMethod === 'paypal'
  ? subtotal + paypalFee - creditApplied
  : subtotal - creditApplied;
```

Replace `total` references in the JSX with `totalAfterCredit` (search for the existing `formatPrice(total, currency)` line).

**Step 3: Add the toggle UI in the Payment Summary section**

Inside the `<div className="space-y-3 mb-6">` block, after the shipping line and before the total, insert:

```tsx
{creditBalance > 0 && (
  <div className="flex items-center justify-between bg-red-50 border border-[#6E0114] rounded p-2">
    <label className="flex items-center gap-2 text-sm cursor-pointer flex-1">
      <input type="checkbox" checked={applyCredit} onChange={e => setApplyCredit(e.target.checked)} />
      <span>Apply store credit ({formatPrice(creditBalance, currency)} available)</span>
    </label>
    {applyCredit && <span className="text-sm font-semibold text-[#6E0114]">-{formatPrice(creditApplied, currency)}</span>}
  </div>
)}
```

**Step 4: Pass `applyStoreCredit` in the checkout body**

Find `const checkoutData = {` and add the field:

```tsx
const checkoutData = {
  items: cartItems.map(...),
  shippingAddress: savedAddress,
  applyStoreCredit: applyCredit,
};
```

**Step 5: Type-check + commit**

```bash
cd frontend && npx tsc --noEmit
git add frontend/app/checkout/page.tsx
git commit -m "feat(store-credit): add apply-credit toggle on checkout"
```

---

## Task 19: Playwright e2e — trade-in happy path

**Files:**
- Create: `frontend/e2e/trade-in.spec.ts`

**Step 1: Write the test**

The shop already runs Playwright with auth fixtures. Use the existing `e2e/fixtures/auth.fixture.ts` pattern (read first to confirm it provides logged-in user / admin contexts).

```typescript
import { test, expect } from './fixtures/auth.fixture';
// ^ adjust to whatever your fixture exports — likely test.use(...) or a "authenticatedPage" helper

test.describe('Trade-in', () => {
  test('public landing page loads', async ({ page }) => {
    await page.goto('/trade-in');
    await expect(page.getByRole('heading', { name: /Trade in your guitar/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Start Trade-In/i }).first()).toBeVisible();
  });

  test('submit page requires login when not authenticated', async ({ page }) => {
    await page.goto('/trade-in/submit');
    await expect(page.getByText(/Sign In Required/i)).toBeVisible();
  });

  // Add an authenticated submit test if your fixtures provide a logged-in user.
  // Skip if the fixture infra isn't trivial — landing + login gate covers the smoke test.
});
```

**Step 2: Run**

Run: `cd frontend && npx playwright test e2e/trade-in.spec.ts`
Expected: 2 tests pass.

If tests fail because the dev server isn't running — start `npm run dev` in another shell first, or check `playwright.config.ts` for the auto-start config.

**Step 3: Commit**

```bash
git add frontend/e2e/trade-in.spec.ts
git commit -m "test(trade-in): add e2e for landing page and login gate"
```

---

## Task 20: Deploy to dev

**Files:** none

**Step 1: Push frontend to dev branch**

Run: `git push origin master:dev`
Expected: push succeeds; Vercel begins auto-deploy to `lgs-dev.vercel.app`.

**Step 2: Deploy backend to dev Fly.io**

Run: `cd backend/GuitarDb.API && fly deploy --app guitar-price-api-dev`
Expected: build + deploy succeed; new revision visible at `https://guitar-price-api-dev.fly.dev`.

**Step 3: Smoke-check dev**

- Visit `https://lgs-dev.vercel.app/trade-in` — landing page renders.
- Visit `https://guitar-price-api-dev.fly.dev/swagger` — confirm new endpoints `POST /api/trade-ins`, `GET /api/admin/trade-ins`, `GET /api/store-credit/me` are listed.
- (Optional) Log in as admin in dev and visit `/admin/trade-ins`.

**Step 4: Report**

Report back the dev URLs, the list of commits shipped, and any smoke-test findings.

---

## Notes for the executing engineer

- **Build before each commit.** Backend `dotnet build` and frontend `npx tsc --noEmit` must pass.
- **Don't skip the `cd frontend &&` prefix** for the type-check — it relies on the local tsconfig.
- **If a Mongo helper method name conflicts** with something existing, prefix with `TradeIn` rather than renaming the existing one.
- **If the existing admin nav structure resists adding a link**, just leave a TODO comment and ship — the admin can navigate via the URL until layout work is done.
- **Don't try to wire PayPal-side store-credit deduction in this batch.** Stripe integration covers the primary flow; PayPal integration is a follow-up since PayPal's order amount is fixed at order-creation time and would need extra plumbing through `PayPalCheckoutButton`.
- **Re-running migrations**: indexes are idempotent in MongoDB driver — re-deploying is safe.
- **Logged out visitors can still see `/trade-in` but `/trade-in/submit` and `/trade-in/[id]` show the sign-in stub.**
