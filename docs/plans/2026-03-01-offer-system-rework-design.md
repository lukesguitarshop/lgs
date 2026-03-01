# Offer System Rework - Design Document

**Date:** 2026-03-01
**Status:** Approved
**Approach:** Refactor existing Offer model into Conversation with typed events

## Overview

Rework the offer system to model after Reverb's chat-like offer experience. The current system has confusing counter-offer flow and authorization bugs. The new system treats offers as a conversation between buyer and seller with turn-based negotiation.

## Requirements

- Chat-like conversation model (one conversation per buyer-listing pair)
- Unified thread with offers as special "bubbles" inline with messages
- Either party (buyer or seller) can initiate an offer
- Turn-based: only the recipient can Accept/Counter/Decline
- Offers expire after 48 hours (auto-decline)
- Accepted offers hold item for 72 hours (existing behavior)
- Email notifications with links for: offer sent, accepted, countered, declined, expired
- Fix all authorization bugs

## Data Model

### OfferConversation (replaces Offer)

```csharp
public class OfferConversation
{
    ObjectId _id
    ObjectId listing_id
    ObjectId buyer_id
    ObjectId seller_id              // Explicitly stored (no lookup needed)

    // Turn-based state
    string pending_action_by        // "buyer" | "seller" | null (when settled)
    decimal? pending_offer_amount   // Current offer awaiting response
    DateTime? pending_expires_at    // 48 hours from last offer

    // Final state
    string status                   // "active" | "accepted" | "declined" | "expired"
    decimal? accepted_amount        // Set when accepted

    // Unified event stream
    List<ConversationEvent> events

    DateTime created_at
    DateTime updated_at
}
```

### ConversationEvent

```csharp
public class ConversationEvent
{
    string type                     // "message" | "offer" | "accept" | "decline" | "expire"
    ObjectId? sender_id
    string? message_text            // For "message" type
    decimal? offer_amount           // For "offer" type
    DateTime created_at
}
```

### Key Changes from Current Model

- `pending_action_by` tracks whose turn it is
- `pending_expires_at` enables 48-hour auto-expiration
- `events` array replaces `messages` - each event is typed
- `seller_id` stored explicitly (no need to look up listing)
- Removes confusing `current_offer_amount` vs `counter_offer_amount` distinction

## API Endpoints

### Conversations

```
GET    /api/conversations                     List user's conversations (as buyer or seller)
GET    /api/conversations/{id}                Get conversation with full event history
POST   /api/conversations                     Start new conversation (with optional first offer)
```

### Actions (turn-based)

```
POST   /api/conversations/{id}/offer          Make or counter offer (sets 48hr expiry)
POST   /api/conversations/{id}/accept         Accept pending offer
POST   /api/conversations/{id}/decline        Decline pending offer
POST   /api/conversations/{id}/message        Send text message (doesn't affect turn)
```

### Admin

```
GET    /api/admin/conversations               List all conversations (with filters)
```

### Authorization Rules

- Only `buyer_id` or `seller_id` can access their conversation
- `offer`, `accept`, `decline` only work when `pending_action_by` matches caller
- Messages can be sent anytime by either party
- Admins can view but not act on conversations

### Deprecated Endpoints

- `/api/offers/*` endpoints deprecated, redirect to new system

## Frontend UI

### Pages

```
/conversations                    # List of all user's offer conversations
/conversations/[id]               # Chat-style conversation view
```

### Components

```
ConversationList.tsx          # Grid/list of conversation cards
ConversationCard.tsx          # Preview card (listing image, last message, status)
ConversationThread.tsx        # Chat-style message thread
MessageBubble.tsx             # Regular text message
OfferBubble.tsx               # Special offer bubble with amount + actions
OfferInput.tsx                # Input for making/countering offers
```

### OfferBubble Behavior

- Shows offer amount prominently
- If it's YOUR turn to respond: shows Accept / Counter / Decline buttons
- If it's THEIR turn: shows "Waiting for response" + expiry countdown
- If expired/declined/accepted: shows final state (greyed out)

### ConversationThread Layout

- Left side: Listing card (image, title, price)
- Right side: Chat thread with messages and offer bubbles
- Bottom: Message input + "Make Offer" button

### Navigation Changes

- Replace `/offers` route with `/conversations`
- Update "Make Offer" button on listings to open conversation or create new one

## Email Notifications

### Trigger Points

| Event | Recipient | Email Subject |
|-------|-----------|---------------|
| New offer made | Other party | "New offer on [Listing Title]" |
| Counter offer | Other party | "Counter offer on [Listing Title]" |
| Offer accepted | Both parties | "Offer accepted on [Listing Title]" |
| Offer declined | Offerer | "Offer declined on [Listing Title]" |
| Offer expired | Both parties | "Offer expired on [Listing Title]" |

### Email Content

- Listing thumbnail + title
- Offer amount
- Clear CTA button: "View Conversation" linking to `/conversations/{id}`
- For accepted: include "Complete Purchase" link to cart

### Expiration Background Job

- Runs every 15 minutes
- Finds conversations where `pending_expires_at < now` and `status = "active"`
- Sets `status = "expired"`, adds `expire` event
- Sends notification emails to both parties

## Migration Strategy

### Data Migration

- Transform existing `Offer` documents to `OfferConversation` format
- Convert `messages` array to `events` array with appropriate types
- Populate `seller_id` by looking up listing owner
- Set `pending_action_by` based on current `status` for active offers

### Code Cleanup

- Remove old `OffersController.cs` after new system is stable
- Remove old `/offers` frontend pages
- Update `MakeOfferModal` to create/open conversation instead
- Fix all authorization bugs in new controller from the start

### Cart Integration

- Keep `PendingCartItem` system (works well)
- Create pending cart item when offer accepted (72-hour hold)
- Auto-decline other conversations on same listing when one is accepted
