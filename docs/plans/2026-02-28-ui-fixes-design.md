# UI/UX Fixes and Features Design

**Date:** 2026-02-28

## Overview

Collection of UI/UX fixes addressing mobile responsiveness issues and adding new features for links in messages, copy button, and email improvements.

---

## Feature 1: Clickable Links in Messages

**Problem:** URLs in message text appear as plain text and are not clickable.

**Solution:** Create `linkifyText()` utility that detects URLs and renders them as clickable links.

**Files:**
- `frontend/lib/utils.ts` - Add linkify utility function
- `frontend/app/messages/[conversationId]/page.tsx` - Update MessageBubble to use linkify

**Behavior:**
- Detect http/https URLs using regex
- Render as `<a>` tags with underline styling
- Open in new tab (`target="_blank" rel="noopener noreferrer"`)

---

## Feature 2: Copy Button for Listing Title

**Problem:** No easy way to copy listing title.

**Solution:** Add copy icon button next to listing title on detail page.

**Files:**
- `frontend/app/listing/[id]/ListingDetail.tsx` - Add Copy button next to title

**Behavior:**
- Small copy icon (lucide-react `Copy`)
- Click copies title to clipboard
- Show toast notification on success

---

## Feature 3: Listing Link from Admin Portal

**Problem:** No direct link to view listing from manage listings tab.

**Solution:** Add "View" link in listings table.

**Files:**
- `frontend/app/admin/page.tsx` - Add View link/button in listings table

**Behavior:**
- Link to `/listing/[id]`
- Opens in new tab

---

## Feature 4: Deal Finder Mobile Fix

**Problem:** Buttons overflow container on mobile.

**Solution:** Add `flex-wrap` to button containers.

**Files:**
- `frontend/components/admin/DealFinderTab.tsx` - Update button container classes

**Changes:**
- `flex gap-2` → `flex flex-wrap gap-2`

---

## Feature 5: Messages Tab Mobile Fix

**Problem:** "New Message" and "Refresh" buttons go out of container.

**Solution:** Add `flex-wrap` to header buttons container.

**Files:**
- `frontend/app/admin/page.tsx` - Update messages tab header

---

## Feature 6: Orders Page Expandable Items

**Problem:** Order items truncated, cannot see full listing names.

**Solution:** Add expand/collapse toggle for order items.

**Files:**
- `frontend/app/profile/page.tsx` - Add expandable items in user orders
- `frontend/app/admin/page.tsx` - Add expandable items in admin orders table

**Behavior:**
- Default: truncated items
- Click to expand: show full titles with wrapping
- Similar to existing address expansion pattern

---

## Feature 7: Listing Detail Page Fixes

**Problems:**
1. "Message Luke's Guitar Shop" button text too long
2. Reviews carousel orange outline cut off

**Solutions:**
1. Shorten to "Message Seller" or use responsive text
2. Add padding to carousel container

**Files:**
- `frontend/app/listing/[id]/ListingDetail.tsx` - Fix button text
- `frontend/app/listing/[id]/ReviewsCarousel.tsx` - Add padding for ring visibility

---

## Feature 8: Profile Page Edit Button Fix

**Problem:** Edit Profile button falls out of container on mobile.

**Solution:** Responsive flex direction.

**Files:**
- `frontend/app/profile/page.tsx` - Update CardHeader flex classes

**Changes:**
- `flex flex-row` → `flex flex-col sm:flex-row`
- Center button on mobile

---

## Feature 9: Shop Info Page Tabs Fix

**Problem:** 4-column tabs overlap on mobile.

**Solution:** 2-column grid on mobile, 4-column on desktop.

**Files:**
- `frontend/app/shop-info/page.tsx` - Update TabsList grid classes

**Changes:**
- `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`

---

## Feature 10: Email Link to Conversation

**Problem:** New message email has no link to the conversation.

**Solution:** Add direct link to conversation in email.

**Files:**
- `backend/GuitarDb.API/Services/EmailService.cs` - Add link to email template
- `backend/GuitarDb.API/Controllers/MessagesController.cs` - Pass conversationId
- `backend/GuitarDb.API/appsettings.json` - Add FrontendUrl config

**Email Template Addition:**
```html
<a href="{frontendUrl}/messages/{conversationId}" style="...">View Conversation</a>
```

---

## Summary of File Changes

| File | Changes |
|------|---------|
| `frontend/lib/utils.ts` | Add linkifyText utility |
| `frontend/app/messages/[conversationId]/page.tsx` | Use linkify in MessageBubble |
| `frontend/app/listing/[id]/ListingDetail.tsx` | Copy button, shorter message button text |
| `frontend/app/listing/[id]/ReviewsCarousel.tsx` | Add padding for ring visibility |
| `frontend/app/admin/page.tsx` | View link, flex-wrap, expandable items |
| `frontend/components/admin/DealFinderTab.tsx` | flex-wrap on buttons |
| `frontend/app/profile/page.tsx` | Responsive header, expandable items |
| `frontend/app/shop-info/page.tsx` | Responsive tab grid |
| `backend/GuitarDb.API/Services/EmailService.cs` | Add conversation link |
| `backend/GuitarDb.API/Controllers/MessagesController.cs` | Pass conversationId |
| `backend/GuitarDb.API/appsettings.json` | Add FrontendUrl |
