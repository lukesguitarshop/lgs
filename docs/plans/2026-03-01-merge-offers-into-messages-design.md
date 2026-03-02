# Merge Offers into Messages System

## Overview

Merge the separate offer_conversations system into the existing messages/conversations system. Offers become a special message type within conversations, eliminating duplicate systems.

## Goals

- Single unified conversation system for both messages and offers
- Any listing-linked conversation can have offers (one active offer at a time)
- Admin "Offers" tab shows all conversations with offers
- Messages tab shows ALL conversations
- Rename user-facing "Conversations" to "Offers"

## Data Model Changes

### Conversation Model (add fields)

```csharp
// Offer state (null if no active offer)
public decimal? ActiveOfferAmount { get; set; }
public string? ActiveOfferBy { get; set; }      // userId who made the offer
public string? PendingActionBy { get; set; }    // "buyer" or "seller"
public DateTime? OfferExpiresAt { get; set; }
public string? OfferStatus { get; set; }        // "active", "accepted", "declined", "expired"
public decimal? AcceptedAmount { get; set; }    // final accepted price
```

### Message Model (add fields)

```csharp
public string Type { get; set; } = "text";      // "text", "offer", "accept", "decline", "expire"
public decimal? OfferAmount { get; set; }       // for offer messages
```

## API Changes

### New Endpoints (add to MessagesController)

```
POST /api/messages/conversations/{id}/offer     - Make an offer
POST /api/messages/conversations/{id}/accept    - Accept offer
POST /api/messages/conversations/{id}/decline   - Decline offer
```

### Admin Endpoint

```
GET /api/admin/offers   - All conversations with offers (OfferStatus != null)
```

### Deleted

- `ConversationsController` (`/api/conversations/*`) - delete after migration

### Modified

- `OfferExpirationService` - query `conversations` collection instead of `offer_conversations`

## Frontend Changes

### Routes

| Old | New |
|-----|-----|
| `/conversations` | Delete (redirect to `/messages`) |
| `/conversations/[id]` | Delete (use `/messages/[id]`) |
| `/offers` (old system) | Delete |
| `/messages` | Shows ALL conversations with offer badges |
| `/messages/[id]` | Conversation detail with offer bubbles |

### Profile Page

- "Negotiations" link renamed to "Offers", links to `/messages?filter=offers`

### Admin Portal

- Remove old "offers" tab (OfferCard)
- "messages" tab shows all conversations
- New "offers" tab filters to conversations with offers

### Components

- Delete `frontend/components/conversations/*`
- Enhance `/messages/[id]` page with offer bubbles and actions
- Add "Make Offer" button (shows if listingId exists and no active offer)

### Notifications

- Update links from `/conversations/{id}` to `/messages/{id}`

## Migration Plan

### Data Migration

1. For each `offer_conversations` document:
   - Find or create `Conversation` with matching participants + listingId
   - Copy offer state fields
   - Convert `ConversationEvent[]` to `Message` documents with type field
2. Verify migration
3. Drop `offer_conversations` collection

### Code Cleanup

Delete:
- `OfferConversation.cs`
- `ConversationsController.cs`
- `frontend/lib/conversations.ts`
- `frontend/components/conversations/`
- `frontend/app/conversations/`
- `frontend/app/offers/`

### Rollout Order

1. Add new fields to Conversation + Message models
2. Add offer endpoints to MessagesController
3. Update frontend messages UI with offer support
4. Run data migration
5. Update admin portal
6. Delete old code/routes
