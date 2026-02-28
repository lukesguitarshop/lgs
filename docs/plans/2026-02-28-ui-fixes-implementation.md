# UI/UX Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix mobile responsiveness issues across multiple pages and add new features including clickable links in messages, copy button for listing titles, and email conversation links.

**Architecture:** Frontend-focused changes using React/Next.js components with TailwindCSS responsive utilities. One backend change to add conversation link to email notifications.

**Tech Stack:** Next.js 16, React 19, TailwindCSS, shadcn/ui, .NET 9 (backend email service)

---

## Task 1: Add Linkify Utility for Messages

**Files:**
- Modify: `frontend/lib/utils.ts`

**Step 1: Add linkifyText utility function**

Add to `frontend/lib/utils.ts`:

```typescript
import React from "react";

// URL regex pattern for detecting links
const URL_REGEX = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;

export function linkifyText(text: string): React.ReactNode[] {
  const parts = text.split(URL_REGEX);
  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex since we're reusing it
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:opacity-80"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
```

**Step 2: Verify no TypeScript errors**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add frontend/lib/utils.ts
git commit -m "feat: add linkifyText utility for URL detection in messages"
```

---

## Task 2: Use Linkify in MessageBubble Component

**Files:**
- Modify: `frontend/app/messages/[conversationId]/page.tsx`

**Step 1: Import linkifyText and update MessageBubble**

Add import at top of file:
```typescript
import { linkifyText } from "@/lib/utils";
```

Find the MessageBubble component (around line 536-579) and change:
```tsx
{message.messageText && (
  <p className="text-sm whitespace-pre-wrap break-words">{message.messageText}</p>
)}
```

To:
```tsx
{message.messageText && (
  <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(message.messageText)}</p>
)}
```

**Step 2: Verify no TypeScript errors**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 3: Manual test**

1. Start dev server: `npm run dev`
2. Navigate to a conversation with a URL in a message
3. Verify URL is clickable and opens in new tab

**Step 4: Commit**

```bash
git add frontend/app/messages/[conversationId]/page.tsx
git commit -m "feat: make URLs clickable in chat messages"
```

---

## Task 3: Add Copy Button to Listing Title

**Files:**
- Modify: `frontend/app/listing/[id]/ListingDetail.tsx`

**Step 1: Add Copy import and state**

Add to imports:
```typescript
import { Copy, Check } from "lucide-react";
```

Add state inside the component:
```typescript
const [copied, setCopied] = useState(false);

const copyTitle = async () => {
  await navigator.clipboard.writeText(listing.listing_title);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
};
```

**Step 2: Add copy button next to title**

Find the listing title `<h1>` element and wrap it with a flex container:

```tsx
<div className="flex items-start gap-2">
  <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">
    {listing.listing_title}
  </h1>
  <button
    onClick={copyTitle}
    className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 mt-1"
    title="Copy title"
  >
    {copied ? (
      <Check className="h-5 w-5 text-green-500" />
    ) : (
      <Copy className="h-5 w-5" />
    )}
  </button>
</div>
```

**Step 3: Verify no TypeScript errors**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Manual test**

1. Navigate to any listing detail page
2. Click copy button
3. Verify title copied to clipboard, icon changes to checkmark

**Step 5: Commit**

```bash
git add frontend/app/listing/[id]/ListingDetail.tsx
git commit -m "feat: add copy button next to listing title"
```

---

## Task 4: Add View Link in Admin Listings Table

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Add Eye icon import**

Add to existing lucide-react imports:
```typescript
import { Eye } from "lucide-react";
```

**Step 2: Add View link in listings table**

Find the Action column in the listings table (around line 570-584). Add a View link before the toggle button:

```tsx
<td className="py-3 px-2">
  <div className="flex items-center gap-2">
    <a
      href={`/listing/${listing.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
    >
      <Eye className="h-3 w-3" />
      View
    </a>
    {/* existing toggle button */}
  </div>
</td>
```

**Step 3: Verify no TypeScript errors**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: add View link in admin listings table"
```

---

## Task 5: Fix Deal Finder Mobile Buttons

**Files:**
- Modify: `frontend/components/admin/DealFinderTab.tsx`

**Step 1: Add flex-wrap to top action buttons**

Find the top action buttons container (around line 211):
```tsx
<div className="flex gap-2">
```

Change to:
```tsx
<div className="flex flex-wrap gap-2">
```

**Step 2: Add flex-wrap to bulk action buttons**

Find the bulk action buttons (around line 306):
```tsx
<div className="flex gap-2">
```

Change to:
```tsx
<div className="flex flex-wrap gap-2">
```

**Step 3: Verify no TypeScript errors**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Manual test**

1. Open browser dev tools, set viewport to mobile (375px)
2. Navigate to admin portal > Deals tab
3. Verify buttons wrap to new rows instead of overflowing

**Step 5: Commit**

```bash
git add frontend/components/admin/DealFinderTab.tsx
git commit -m "fix: wrap Deal Finder buttons on mobile"
```

---

## Task 6: Fix Messages Tab Mobile Buttons

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Add flex-wrap to messages tab header buttons**

Find the messages tab header buttons container (around line 676-692):
```tsx
<div className="flex items-center gap-2">
```

Change to:
```tsx
<div className="flex flex-wrap items-center gap-2">
```

**Step 2: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "fix: wrap Messages tab buttons on mobile"
```

---

## Task 7: Add Expandable Order Items - Profile Page

**Files:**
- Modify: `frontend/app/profile/page.tsx`

**Step 1: Add state for expanded orders**

Add state near other state declarations:
```typescript
const [expandedOrderItems, setExpandedOrderItems] = useState<string | null>(null);
```

**Step 2: Update order items rendering**

Find the order items section (around line 214-219). Replace:
```tsx
<div className="text-sm text-muted-foreground">
  {order.items.map((item, idx) => (
    <p key={idx} className="truncate">
      {item.quantity}x {item.listingTitle}
    </p>
  ))}
</div>
```

With:
```tsx
<div className="text-sm text-muted-foreground">
  {expandedOrderItems === order.id ? (
    <>
      {order.items.map((item, idx) => (
        <p key={idx} className="break-words">
          {item.quantity}x {item.listingTitle}
        </p>
      ))}
      <button
        onClick={() => setExpandedOrderItems(null)}
        className="text-xs text-[#df5e15] hover:underline mt-1"
      >
        Show less
      </button>
    </>
  ) : (
    <>
      {order.items.slice(0, 2).map((item, idx) => (
        <p key={idx} className="truncate">
          {item.quantity}x {item.listingTitle}
        </p>
      ))}
      {order.items.length > 0 && (
        <button
          onClick={() => setExpandedOrderItems(order.id)}
          className="text-xs text-[#df5e15] hover:underline mt-1"
        >
          {order.items.length > 2 ? `Show all ${order.items.length} items` : 'Show full titles'}
        </button>
      )}
    </>
  )}
</div>
```

**Step 3: Verify no TypeScript errors**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add frontend/app/profile/page.tsx
git commit -m "feat: add expandable order items on profile page"
```

---

## Task 8: Add Expandable Order Items - Admin Orders Tab

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Add state for expanded order items**

Find the admin page component and add state:
```typescript
const [expandedOrderItems, setExpandedOrderItems] = useState<string | null>(null);
```

**Step 2: Update admin orders items column**

Find the Items column in orders table (around line 1050-1060). Replace:
```tsx
<td className="py-3 px-2">
  <div className="space-y-1">
    {order.items.map((item, idx) => (
      <div key={idx} className="text-xs">
        <span className="text-gray-900 line-clamp-1">{item.listingTitle}</span>
        <span className="text-gray-500 ml-1">({item.quantity}x ${item.price.toLocaleString()})</span>
      </div>
    ))}
  </div>
</td>
```

With:
```tsx
<td className="py-3 px-2">
  <div className="space-y-1">
    {expandedOrderItems === order.id ? (
      <>
        {order.items.map((item, idx) => (
          <div key={idx} className="text-xs">
            <span className="text-gray-900 break-words">{item.listingTitle}</span>
            <span className="text-gray-500 ml-1">({item.quantity}x ${item.price.toLocaleString()})</span>
          </div>
        ))}
        <button
          onClick={() => setExpandedOrderItems(null)}
          className="text-xs text-[#df5e15] hover:underline"
        >
          Collapse
        </button>
      </>
    ) : (
      <>
        {order.items.map((item, idx) => (
          <div key={idx} className="text-xs">
            <span className="text-gray-900 line-clamp-1">{item.listingTitle}</span>
            <span className="text-gray-500 ml-1">({item.quantity}x ${item.price.toLocaleString()})</span>
          </div>
        ))}
        <button
          onClick={() => setExpandedOrderItems(order.id)}
          className="text-xs text-[#df5e15] hover:underline"
        >
          Expand
        </button>
      </>
    )}
  </div>
</td>
```

**Step 3: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: add expandable order items in admin orders tab"
```

---

## Task 9: Fix Listing Detail Page - Message Button and Reviews

**Files:**
- Modify: `frontend/app/listing/[id]/ListingDetail.tsx`

**Step 1: Shorten Message Seller button text**

Find the Message Seller button (around line 470-479). Change:
```tsx
<Button
  variant="outline"
  className="flex-1 py-6 text-lg"
  onClick={handleMessageSeller}
  disabled={isMessageLoading}
>
  <MessageSquare className="h-5 w-5 mr-2" />
  {isMessageLoading ? 'Opening...' : "Message Luke's Guitar Shop"}
</Button>
```

To:
```tsx
<Button
  variant="outline"
  className="flex-1 py-6 text-base sm:text-lg"
  onClick={handleMessageSeller}
  disabled={isMessageLoading}
>
  <MessageSquare className="h-5 w-5 mr-2" />
  {isMessageLoading ? 'Opening...' : "Message Seller"}
</Button>
```

**Step 2: Commit**

```bash
git add frontend/app/listing/[id]/ListingDetail.tsx
git commit -m "fix: shorten Message Seller button text for mobile"
```

---

## Task 10: Fix Reviews Carousel Outline Cutoff

**Files:**
- Modify: `frontend/app/listing/[id]/ReviewsCarousel.tsx`

**Step 1: Add padding to carousel container**

Find the carousel container (around line 182):
```tsx
<div
  ref={containerRef}
  className="flex gap-4 overflow-x-auto px-2 py-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
```

Change `px-2` to `px-4`:
```tsx
<div
  ref={containerRef}
  className="flex gap-4 overflow-x-auto px-4 py-4 scroll-smooth snap-x snap-mandatory scrollbar-hide"
```

**Step 2: Commit**

```bash
git add frontend/app/listing/[id]/ReviewsCarousel.tsx
git commit -m "fix: add padding to reviews carousel to prevent ring cutoff"
```

---

## Task 11: Fix Profile Page Edit Button

**Files:**
- Modify: `frontend/app/profile/page.tsx`

**Step 1: Make CardHeader responsive**

Find the CardHeader (around line 121-136):
```tsx
<CardHeader className="flex flex-row items-center justify-between">
```

Change to:
```tsx
<CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
```

**Step 2: Adjust button alignment on mobile**

The button will now stack below on mobile. Optionally wrap button in a div for better mobile alignment:
```tsx
<div className="w-full sm:w-auto">
  <Link href="/profile/edit">
    <Button variant="outline" size="sm" className="w-full sm:w-auto">
      <Edit className="h-4 w-4 mr-2" />
      Edit Profile
    </Button>
  </Link>
</div>
```

**Step 3: Commit**

```bash
git add frontend/app/profile/page.tsx
git commit -m "fix: make Edit Profile button responsive on mobile"
```

---

## Task 12: Fix Shop Info Page Tabs

**Files:**
- Modify: `frontend/app/shop-info/page.tsx`

**Step 1: Make tabs responsive**

Find the TabsList (around line 424):
```tsx
<TabsList className="grid w-full grid-cols-4 mb-8">
```

Change to:
```tsx
<TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-8">
```

**Step 2: Commit**

```bash
git add frontend/app/shop-info/page.tsx
git commit -m "fix: make shop info tabs 2-column on mobile"
```

---

## Task 13: Add Conversation Link to Email Notification

**Files:**
- Modify: `backend/GuitarDb.API/appsettings.json`
- Modify: `backend/GuitarDb.API/appsettings.Development.json`
- Modify: `backend/GuitarDb.API/Services/EmailService.cs`
- Modify: `backend/GuitarDb.API/Controllers/MessagesController.cs`

**Step 1: Add FrontendUrl to appsettings.json**

Add to root level of appsettings.json:
```json
"FrontendUrl": "https://frontend-eta-seven-13.vercel.app"
```

**Step 2: Add FrontendUrl to appsettings.Development.json**

Add to root level:
```json
"FrontendUrl": "http://localhost:3000"
```

**Step 3: Update EmailService constructor and method**

In `Services/EmailService.cs`, add field:
```csharp
private readonly string? _frontendUrl;
```

In constructor, add:
```csharp
_frontendUrl = configuration["FrontendUrl"];
```

Update `SendNewMessageNotificationAsync` signature to accept conversationId:
```csharp
public async Task SendNewMessageNotificationAsync(
    string recipientEmail,
    string senderName,
    string messagePreview,
    string? listingTitle = null,
    string? conversationId = null)
```

Update email body to include link:
```csharp
var conversationLink = !string.IsNullOrEmpty(conversationId) && !string.IsNullOrEmpty(_frontendUrl)
    ? $@"<p><a href=""{_frontendUrl}/messages/{conversationId}"" style=""display: inline-block; background-color: #df5e15; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;"">View Conversation</a></p>"
    : "";

var body = $@"
<h2>New Message</h2>
<p>You have received a new message from {senderName}.</p>

{(string.IsNullOrEmpty(listingTitle) ? "" : $@"
<p><strong>Regarding:</strong> {listingTitle}</p>
")}

<h3>Message Preview</h3>
<p style=""background-color: #f5f5f5; padding: 15px; border-radius: 5px;"">{messagePreview}</p>

{conversationLink}

<p>Log in to your account to view the full conversation and reply.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";
```

**Step 4: Update MessagesController to pass conversationId**

In `Controllers/MessagesController.cs`, find the email notification calls and add conversationId parameter:

```csharp
_ = _emailService.SendNewMessageNotificationAsync(
    recipient.Email,
    sender?.FullName ?? "Someone",
    preview,
    listing?.ListingTitle,
    conversation.Id.ToString());
```

**Step 5: Build and verify**

Run: `cd G:/Projects/lgs/backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 6: Commit**

```bash
git add backend/GuitarDb.API/appsettings.json backend/GuitarDb.API/appsettings.Development.json backend/GuitarDb.API/Services/EmailService.cs backend/GuitarDb.API/Controllers/MessagesController.cs
git commit -m "feat: add conversation link to new message email notifications"
```

---

## Task 14: Final Verification

**Step 1: Run frontend type check**

Run: `cd G:/Projects/lgs/frontend && npx tsc --noEmit`
Expected: No errors

**Step 2: Run backend build**

Run: `cd G:/Projects/lgs/backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 3: Manual testing checklist**

1. [ ] Messages page - URLs are clickable, open in new tab
2. [ ] Listing detail - Copy button works, shows checkmark
3. [ ] Admin listings - View link opens listing in new tab
4. [ ] Admin deals tab - Buttons wrap on mobile (375px)
5. [ ] Admin messages tab - Buttons wrap on mobile
6. [ ] Profile orders - Items expand/collapse
7. [ ] Admin orders - Items expand/collapse
8. [ ] Listing detail - Message Seller button fits on mobile
9. [ ] Listing detail - Reviews carousel ring not cut off
10. [ ] Profile page - Edit button stacks on mobile
11. [ ] Shop info - Tabs show as 2x2 grid on mobile
12. [ ] Email notification - Contains "View Conversation" button

---

## Summary

| Task | Feature | Status |
|------|---------|--------|
| 1-2 | Clickable links in messages | |
| 3 | Copy button for listing title | |
| 4 | View link in admin listings | |
| 5 | Deal Finder mobile fix | |
| 6 | Messages tab mobile fix | |
| 7-8 | Expandable order items | |
| 9 | Message Seller button text | |
| 10 | Reviews carousel padding | |
| 11 | Profile Edit button | |
| 12 | Shop Info tabs | |
| 13 | Email conversation link | |
| 14 | Final verification | |
