# LGS (Luke's Guitar Shop) - Codebase Summary

## Project Overview

A guitar listing and e-commerce platform that scrapes guitars from Reverb and allows purchasing through Stripe and PayPal.

---

## Architecture

**Monorepo with two main components:**

```
G:\Projects\lgs\
├── backend/                    # .NET 9.0 Web API
│   ├── GuitarDb.API/          # Main API project
│   └── GuitarDb.Scraper/      # Reverb scraper project
└── frontend/                   # Next.js 16.1.1 React app
```

---

## Backend (G:\Projects\lgs\backend\GuitarDb.API)

**Tech Stack:** .NET 9.0, ASP.NET Core, MongoDB, Stripe.net

### Controllers

| File | Purpose |
|------|---------|
| `Controllers/AuthController.cs` | User authentication (register, login, guest sessions, profile) |
| `Controllers/CheckoutController.cs` | Stripe checkout session creation, order completion, cleans up pending cart items after payment |
| `Controllers/AdminController.cs` | Admin scraper trigger, listing management, seed reviews (requires admin auth via `[AdminAuthorize]`) |
| `Controllers/MyListingsController.cs` | CRUD for guitar listings |
| `Controllers/ReviewsController.cs` | Customer reviews with filtering and statistics |
| `Controllers/FavoritesController.cs` | User favorites CRUD (requires auth) |
| `Controllers/OffersController.cs` | Buyer/seller offer management (requires auth) |
| `Controllers/MessagesController.cs` | Direct messaging to admin (requires auth); regular users can only message admin |
| `Controllers/CartController.cs` | Pending cart items from accepted offers (requires auth) |

### Models

| File | Purpose |
|------|---------|
| `Models/Order.cs` | Order with items, shipping, payment method (stripe/paypal) |
| `Models/MyListing.cs` | Guitar listing (title, price, images, condition, disabled flag) |
| `Models/Review.cs` | Customer review (guitar_name, reviewer_name, review_date, rating, review_text) |
| `Models/User.cs` | User profile (email, password_hash, full_name, is_guest, is_admin, email_verified) |
| `Models/Favorite.cs` | User favorite (user_id, listing_id, created_at) |
| `Models/Offer.cs` | Buyer offer (listing_id, buyer_id, amounts, status, messages) |
| `Models/Message.cs` | Direct message (conversation_id, sender_id, recipient_id, message_text) |
| `Models/Conversation.cs` | Conversation (participant_ids, listing_id, last_message) |
| `Models/PendingCartItem.cs` | Locked cart item from accepted offer (user_id, listing_id, offer_id, price, expires_at) |
| `Models/PasswordResetToken.cs` | Password reset token (user_id, token, expires_at, used) |
| `Models/EmailVerificationToken.cs` | Email verification token (user_id, token, expires_at, used) |
| `Models/Reverb/ReverbListing.cs` | Reverb API listing model with all nested types |
| `Models/Reverb/ReverbListingsResponse.cs` | Reverb API response wrapper with pagination |

### Services

| File | Purpose |
|------|---------|
| `Services/AuthService.cs` | JWT token generation/validation, password hashing (BCrypt) |
| `Services/EmailService.cs` | Email notifications for offers and messages (SMTP) |
| `Services/MongoDbService.cs` | MongoDB operations for listings, orders, users, pending cart items (includes GetAdminUserAsync, CreatePendingCartItemAsync, GetPendingCartItemsByUserAsync, DeletePendingCartItemByListingAsync) |
| `Services/ScraperService.cs` | Reverb API integration and scraper orchestration (for production deployment) |

### Helpers

| File | Purpose |
|------|---------|
| `Helpers/UrlHelper.cs` | URL normalization utilities (enforces https, removes trailing slashes) |

### Attributes

| File | Purpose |
|------|---------|
| `Attributes/AdminAuthorizeAttribute.cs` | Authorization filter requiring authenticated user with `is_admin` claim set to true. Returns 401 if not authenticated, 403 if not admin. |

### DTOs

| File | Purpose |
|------|---------|
| `DTOs/CheckoutRequest.cs` | Cart items and shipping address for checkout |

### Configuration

| File | Purpose |
|------|---------|
| `appsettings.json` | Base config (CORS, MongoDB, Stripe, PayPal) |
| `appsettings.Development.json` | Dev secrets (API keys) |
| `Program.cs` | Service registration, middleware setup |

### Key Endpoints

```
POST   /api/auth/register           - Register new user account (sends verification email)
POST   /api/auth/login              - Login with email/password (requires verified email, returns JWT)
GET    /api/auth/me                 - Get current user profile (requires auth)
PUT    /api/auth/profile            - Update user profile (requires auth)
GET    /api/auth/orders             - Get current user's order history (requires auth)
POST   /api/auth/forgot-password    - Request password reset email
POST   /api/auth/reset-password     - Reset password with token
POST   /api/auth/verify-email       - Verify email with token
POST   /api/auth/resend-verification - Resend verification email

GET    /api/mylistings              - Get all active listings
GET    /api/mylistings/{id}         - Get listing by ID
POST   /api/mylistings              - Create listing
PUT    /api/mylistings/{id}         - Update listing
DELETE /api/mylistings/{id}         - Delete listing
PATCH  /api/mylistings/{id}/disable - Toggle listing disabled

POST   /api/checkout                - Create Stripe checkout session (requires auth)
POST   /api/checkout/complete       - Complete Stripe order after payment (requires auth, removes pending cart items)
POST   /api/checkout/paypal/create  - Create PayPal order (requires auth)
POST   /api/checkout/paypal/capture - Capture PayPal payment (requires auth, removes pending cart items)

POST   /api/admin/run-scraper       - Trigger Reverb scraper (requires admin auth)
POST   /api/admin/cleanup-duplicates - Remove duplicate listings by ReverbLink (requires admin auth)
POST   /api/admin/normalize-reverb-links - Normalize existing ReverbLink URLs (requires admin auth)
PATCH  /api/admin/listings/{id}/price - Update listing price (requires admin auth)
POST   /api/admin/seed-reviews       - Import reviews from markdown file (requires admin auth)

GET    /api/reviews                  - Get all reviews (filters: search, dateRange, sort, page)
GET    /api/reviews/stats            - Get review statistics (total, recent count, avg rating)

GET    /api/favorites                - Get all favorites for current user (requires auth)
POST   /api/favorites/{listingId}    - Add listing to favorites (requires auth)
DELETE /api/favorites/{listingId}    - Remove listing from favorites (requires auth)
GET    /api/favorites/check/{listingId} - Check if listing is favorited (requires auth)

POST   /api/offers                   - Create new offer (requires auth)
GET    /api/offers                   - Get all offers for current user/buyer (requires auth)
GET    /api/offers/{offerId}         - Get offer details (requires auth)
GET    /api/offers/listing/{listingId} - Get offers for listing/seller view (requires auth)
PUT    /api/offers/{offerId}/counter - Seller makes counter-offer (requires auth)
PUT    /api/offers/{offerId}/accept  - Accept offer (requires auth, disables listing, creates pending cart item)
PUT    /api/offers/{offerId}/reject  - Reject offer (requires auth)

GET    /api/messages/conversations   - Get all conversations for current user (requires auth)
GET    /api/messages/conversation/{id} - Get messages in conversation (requires auth)
POST   /api/messages                 - Send new message (requires auth, regular users can only message admin)
PUT    /api/messages/{messageId}/read - Mark message as read (requires auth)
GET    /api/messages/unread-count    - Get unread message count (requires auth)
POST   /api/messages/contact-seller  - Start conversation with admin about a listing (requires auth)

GET    /api/admin/offers             - Get all offers for admin (requires admin auth, optional status/listingId filters)
PUT    /api/admin/offers/{id}/counter - Admin counter-offer (requires admin auth)
PUT    /api/admin/offers/{id}/accept  - Admin accept offer (requires admin auth, disables listing, creates pending cart item)
PUT    /api/admin/offers/{id}/reject  - Admin reject offer (requires admin auth)

GET    /api/admin/orders             - Get all orders for admin with buyer info (requires admin auth)
GET    /api/admin/pending-cart-items - Get all pending cart items for admin with buyer info (requires admin auth)
DELETE /api/admin/pending-cart-items/{id} - Cancel pending cart item and re-enable listing (requires admin auth)

GET    /api/cart/pending             - Get pending cart items for current user (locked items from accepted offers, requires auth)
```

---

## Frontend (G:\Projects\lgs\frontend)

**Tech Stack:** Next.js 16.1.1, React 19.2.3, TypeScript, TailwindCSS, shadcn/ui

### App Routes

| Path | File | Purpose |
|------|------|---------|
| `/` | `app/page.tsx` | Home page with search and filters |
| `/listing/[id]` | `app/listing/[id]/page.tsx` | Listing detail page |
| `/filter` | `app/filter/page.tsx` | Mobile-only full-screen filter page |
| `/cart` | `app/cart/page.tsx` | Shopping cart (merges localStorage items with pending/locked items from accepted offers) |
| `/checkout` | `app/checkout/page.tsx` | Checkout with shipping form |
| `/checkout/success` | `app/checkout/success/page.tsx` | Order confirmation |
| `/checkout/cancel` | `app/checkout/cancel/page.tsx` | Cancelled payment |
| `/about` | `app/about/page.tsx` | About page |
| `/reviews` | `app/reviews/page.tsx` | Customer reviews with filtering and stats |
| `/admin` | `app/admin/page.tsx` | Admin portal with scraper, offers, messages, listings, orders management (requires isAdmin via AuthContext) |
| `/profile` | `app/profile/page.tsx` | User profile with info, quick links, order history |
| `/profile/edit` | `app/profile/edit/page.tsx` | Edit profile form (name, password) |
| `/favorites` | `app/favorites/page.tsx` | User favorites list with remove functionality |
| `/offers` | `app/offers/page.tsx` | Buyer's offers list with status filters (requires auth) |
| `/offers/[offerId]` | `app/offers/[offerId]/page.tsx` | Offer detail page with history and actions; shows "Go to Cart" link when offer accepted (requires auth) |
| `/messages` | `app/messages/page.tsx` | Conversations list with unread indicators (requires auth) |
| `/messages/[conversationId]` | `app/messages/[conversationId]/page.tsx` | Chat conversation with message history (requires auth) |
| `/reset-password` | `app/reset-password/page.tsx` | Forgot password and reset password page |
| `/verify-email` | `app/verify-email/page.tsx` | Email verification page (auto-verifies with token from URL) |

### Key Components

| File | Purpose |
|------|---------|
| `app/components/SearchClient.tsx` | Listing grid with filters (desktop sidebar, mobile links to /filter) |
| `app/components/Header.tsx` | Navigation header with hamburger menu on mobile, ProfileButton (includes admin portal for admins, notifications consolidated in profile dropdown) |
| `app/components/Footer.tsx` | Site footer (Home, About, Reviews, Contact links) |
| `app/listing/[id]/ListingDetail.tsx` | Listing display with Add to Cart, Make Offer, Message Seller |
| `components/PayPalCheckoutButton.tsx` | PayPal checkout button with SDK integration |
| `app/reviews/page.tsx` | Reviews page with grid, filters, pagination, and stats |
| `components/ui/*` | shadcn/ui components (Button, Card, Input, Dialog, DropdownMenu, etc.) |
| `components/auth/LoginModal.tsx` | Login modal dialog with email/password form |
| `components/auth/RegisterModal.tsx` | Registration modal dialog with full form |
| `components/auth/ProfileButton.tsx` | User menu dropdown (desktop) and mobile profile buttons, includes Admin Portal link for admin users, notification badge with counts, notifications section in dropdown |
| `components/offers/MakeOfferModal.tsx` | Make offer modal with amount input and validation |
| `components/admin/OfferCard.tsx` | Admin offer management card with counter/accept/reject actions |
| `app/admin/page.tsx` | Admin portal with Reverb scraper, offers management, customer messages (quick reply + full chat link), listings management, and orders tab |

### Contexts

| File | Purpose |
|------|---------|
| `contexts/AuthContext.tsx` | Auth state management (user, isAuthenticated, isAdmin, login, register, logout) |

### Library Files

| File | Purpose |
|------|---------|
| `lib/api.ts` | API client wrapper for backend calls (includes authGet, authPost, authPut for authenticated requests) |
| `lib/auth.ts` | Auth utilities (login, register, logout, getToken, getAuthHeaders, saveShippingAddress) |
| `lib/cart.ts` | localStorage cart management (getCart, addToCart, removeFromCart, clearCart); supports isLocked items from accepted offers (removeFromCart returns false for locked items) |
| `lib/notifications.ts` | Notifications aggregation (offers, messages) with polling and state management |
| `lib/utils.ts` | Utility functions |

### Configuration

| File | Purpose |
|------|---------|
| `.env.local` | Local env vars (API URL, PayPal Client ID) |
| `.env.production` | Production env vars |
| `middleware.ts` | Basic auth middleware |
| `tailwind.config.ts` | Tailwind configuration |

---

## Database (MongoDB)

**Database:** GuitarDb

### Collections

| Collection | Purpose | Key Indexes |
|------------|---------|-------------|
| `my_listings` | Guitar inventory | `scraped_at_idx`, `reverb_link_idx` (unique, sparse) |
| `orders` | Purchase records | `stripe_session_id_idx` (sparse), `paypal_order_id_idx` (sparse), `created_at_idx` |
| `reviews` | Customer reviews (113 imported) | `review_date_idx` |
| `users` | User profiles (registered and guest) | `email_idx` (unique, sparse), `guest_session_id_idx` (unique, sparse) |
| `favorites` | User favorites | `user_listing_idx` (compound, unique), `user_id_idx` |
| `offers` | Buyer offers | `listing_id_idx`, `buyer_id_idx`, `status_idx` |
| `messages` | Direct messages | `conversation_id_idx`, `sender_id_idx`, `recipient_id_idx`, `created_at_idx` |
| `conversations` | User conversations | `participant_ids_idx`, `last_message_at_idx` |
| `pending_cart_items` | Locked cart items from accepted offers | `user_id_idx`, `expires_at_idx` (TTL) |
| `password_reset_tokens` | Password reset tokens | `token_idx` (unique), `expires_at_idx` (TTL) |
| `email_verification_tokens` | Email verification tokens | `token_idx` (unique), `expires_at_idx` (TTL) |

### Order Schema

```javascript
{
  _id: ObjectId,
  payment_method: "stripe" | "paypal",
  stripe_session_id: string | null,
  stripe_payment_intent_id: string | null,
  paypal_order_id: string | null,
  paypal_capture_id: string | null,
  items: [{ listing_id, listing_title, price, currency, quantity }],
  shipping_address: { full_name, line1, line2, city, state, postal_code, country },
  total_amount: decimal,
  currency: string,
  status: string,
  created_at: datetime,
  user_id: ObjectId                   // Reference to User (required)
}
```

### Listing Schema

```javascript
{
  _id: ObjectId,
  listing_title: string,
  description: string,
  images: [string],
  price: decimal,
  currency: string,
  condition: string,
  reverb_link: string,
  disabled: boolean,
  scraped_at: datetime
}
```

### Review Schema

```javascript
{
  _id: ObjectId,
  guitar_name: string,
  reviewer_name: string,
  review_date: datetime,
  rating: int,           // Always 5
  review_text: string
}
```

### User Schema

```javascript
{
  _id: ObjectId,
  email: string | null,           // Unique, null for guests
  password_hash: string | null,   // BCrypt hash, null for guests
  full_name: string,
  created_at: datetime,
  is_guest: boolean,
  shipping_address: {              // Saved shipping address (optional)
    full_name: string,
    line1: string,
    line2: string | null,
    city: string,
    state: string,
    postal_code: string,
    country: string
  } | null,
  is_admin: boolean,              // Admin flag (default: false)
  email_verified: boolean         // Email verification status (default: false)
}
```

### Favorite Schema

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,              // Reference to User
  listing_id: ObjectId,           // Reference to MyListing
  created_at: datetime
}
```

### Offer Schema

```javascript
{
  _id: ObjectId,
  listing_id: ObjectId,           // Reference to MyListing
  buyer_id: ObjectId,             // Reference to User
  initial_offer_amount: decimal,  // Original offer amount
  current_offer_amount: decimal,  // Current accepted amount
  counter_offer_amount: decimal | null, // Seller's counter offer
  status: string,                 // pending, accepted, rejected, countered
  created_at: datetime,
  updated_at: datetime,
  messages: [                     // Offer-related messages
    {
      sender_id: ObjectId,
      message_text: string,
      created_at: datetime,
      is_system_message: boolean
    }
  ]
}
```

### Message Schema

```javascript
{
  _id: ObjectId,
  conversation_id: ObjectId,      // Reference to Conversation
  sender_id: ObjectId,            // Reference to User
  recipient_id: ObjectId,         // Reference to User
  listing_id: ObjectId | null,    // Optional context for listing discussion
  message_text: string,
  created_at: datetime,
  is_read: boolean
}
```

### Conversation Schema

```javascript
{
  _id: ObjectId,
  participant_ids: [ObjectId],    // References to Users (array of 2)
  listing_id: ObjectId | null,    // Optional listing context
  last_message: string | null,    // Preview of last message
  last_message_at: datetime | null,
  created_at: datetime
}
```

### PendingCartItem Schema

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,              // Reference to User (buyer)
  listing_id: ObjectId,           // Reference to MyListing
  offer_id: ObjectId,             // Reference to Offer
  price: decimal,                 // Accepted price
  currency: string,               // Currency code (default: USD)
  listing_title: string,          // Snapshot of listing title
  listing_image: string,          // Snapshot of listing image URL
  created_at: datetime,
  expires_at: datetime            // TTL - auto-deleted after this time (72 hours)
}
```

### PasswordResetToken Schema

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,              // Reference to User
  token: string,                  // Unique reset token
  created_at: datetime,
  expires_at: datetime,           // TTL - 1 hour from creation
  used: boolean                   // Whether token has been used
}
```

### EmailVerificationToken Schema

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,              // Reference to User
  token: string,                  // Unique verification token
  created_at: datetime,
  expires_at: datetime,           // TTL - 24 hours from creation
  used: boolean                   // Whether token has been used
}
```

---

## Payment Flow

### Stripe

1. User adds items to cart (localStorage)
2. User fills shipping address on checkout page
3. User selects "Credit Card" payment method
4. Frontend calls `POST /api/checkout` with cart items + shipping
5. Backend creates Stripe checkout session, returns URL
6. User redirected to Stripe-hosted checkout
7. On success, redirected to `/checkout/success?session_id=xxx`
8. Frontend calls `POST /api/checkout/complete` with session ID
9. Backend verifies payment, creates Order, disables purchased listings

### PayPal

1. User adds items to cart (localStorage)
2. User fills shipping address on checkout page
3. User selects "PayPal" payment method
4. PayPal button appears (via @paypal/react-paypal-js SDK)
5. User clicks PayPal button, frontend calls `POST /api/checkout/paypal/create`
6. Backend creates PayPal order via API, returns orderId
7. User approves payment in PayPal popup
8. On approval, frontend calls `POST /api/checkout/paypal/capture`
9. Backend captures payment, creates Order, disables purchased listings
10. User redirected to `/checkout/success?paypal_order_id=xxx`

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Backend | Fly.io | https://guitar-price-api.fly.dev/api |
| Frontend | Vercel | https://frontend-eta-seven-13.vercel.app |

---

## Key Features

- [x] Guitar listing scraping from Reverb
- [x] Search with filters (price range, condition, sort)
- [x] Shopping cart (localStorage)
- [x] Stripe checkout with shipping address
- [x] PayPal checkout with shipping address
- [x] Account required for checkout (email verification required)
- [x] Order storage in MongoDB
- [x] Auto-disable listings after purchase
- [x] Admin portal with scraper trigger
- [x] Download listing photos as ZIP
- [x] Dark mode toggle
- [x] Mobile-responsive design
- [x] Customer reviews page with 5-star ratings
- [x] User authentication system (JWT-based)
  - User registration with email verification
  - Email verification required before login
  - Profile management
  - Saved shipping address in user profile
  - Password reset via email
  - Frontend: AuthContext, LoginModal, RegisterModal, ProfileButton
- [x] Checkout flow (account required)
  - Authentication required to access checkout
  - Pre-fill shipping address from user profile
  - Option to save address to profile for future orders
  - Login/register prompt on checkout page if not authenticated
- [x] Favorites system
  - Add/remove favorites from listing detail page (heart icon)
  - Favorite indicators on listing cards in home page
  - Dedicated favorites page (/favorites)
  - Requires authentication to add favorites
- [x] Offers system (buyer view)
  - Make offer modal on listing detail page (requires auth)
  - Buyer offers list page (/offers) with status filtering
  - Offer detail page with full history and counter-offer response
  - Accept/reject counter-offer buttons
  - Message seller link
  - Requires authentication
- [x] Offers system (admin/seller view)
  - Admin offers management section in admin portal
  - Filter offers by status (pending/countered/accepted/rejected)
  - Filter offers by listing
  - Counter-offer, accept, reject actions
  - Real-time status updates
  - Search by guitar name or reviewer name
  - Date filters (30/90/180 days, all time)
  - Sort by newest/oldest
  - Pagination (24 per page with "Load More")
  - Statistics display (total reviews, recent count, 5.0 avg rating)
- [x] Admin messages management
  - Customer Messages section in admin portal
  - View all conversations with customers
  - Unread message count per conversation and total
  - Listing context display (thumbnail, title)
  - Last message preview with relative timestamp
  - Inline quick reply functionality
  - Link to view full conversation chat history
- [x] Direct messaging system
  - Conversations list page (/messages) with unread indicators
  - Chat-style conversation detail page with real-time polling (5s)
  - Message input with send functionality
  - Listing context sidebar when applicable
  - Date separators in message thread
  - "Message Seller" button on listing detail page (contacts admin)
  - Regular users can only message admin (shop owner)
  - Admin can message any user (to reply)
  - Requires authentication
- [x] Notifications system
  - Notification badge on profile button with combined count
  - Notifications section in profile dropdown (above menu items)
  - Offer notifications showing pending count with link to offers page
  - Message notifications showing unread count with link to messages page
  - Polling for updates every 30 seconds
  - Mobile: notification summary section in mobile profile menu
- [x] Email notifications
  - New offer notification to seller
  - Counter-offer notification to buyer
  - Offer accepted notification to both parties
  - Offer rejected notification to buyer
  - New message notification to recipient
  - HTML-formatted emails
  - Graceful fallback when SMTP not configured

---

## Mobile Responsiveness

### Header (Mobile Hamburger Menu)

On screens < `lg` (1024px), the header navigation collapses into a hamburger menu:

- **Hamburger icon** toggles a slide-down mobile menu
- **Mobile menu** contains: Home, About, Cart (with badge), Theme toggle
- **Cart icon** and **theme toggle** remain accessible in both states
- Touch-friendly tap targets (44px minimum)

**Implementation:** `app/components/Header.tsx`

### Filter Page (Mobile-Only)

On mobile, the filter sidebar is replaced with a dedicated `/filter` page:

| Desktop (lg+) | Mobile (<lg) |
|---------------|--------------|
| Sidebar filter panel always visible | "Filter" button links to `/filter` |
| Real-time filtering as user types | Full-screen filter page |
| Inline clear/apply | "Apply Filters" button redirects to home |

**Mobile Filter Flow:**
1. User taps "Filter" button on home page
2. Navigates to `/filter` with current filter params preserved in URL
3. User adjusts filters (search, price range, condition, sort)
4. User taps "Apply Filters" → redirects to `/?params`
5. URL params persist throughout (deep-linking supported)

**Filter URL Parameters:**
- `q` - Search query
- `conditions` - Comma-separated condition list (e.g., `Mint,Excellent`)
- `minPrice` - Minimum price
- `maxPrice` - Maximum price
- `sort` - Sort option (`newest`, `price-low`, `price-high`, `alpha`)
- `page` - Pagination (omitted if page 1)

**Implementation:**
- `app/filter/page.tsx` - Mobile filter page
- `app/components/SearchClient.tsx` - Desktop filters + mobile "Filter" button

---

## Environment Variables

### Backend (appsettings.json / appsettings.Development.json)

```
MongoDb:ConnectionString
MongoDb:DatabaseName
Stripe:SecretKey
Stripe:SuccessUrl
Stripe:CancelUrl
PayPal:ClientId
PayPal:ClientSecret
PayPal:Mode
Jwt:SecretKey              - Secret key for JWT signing (min 32 chars)
Jwt:Issuer                 - JWT issuer (default: LukesGuitarShop)
Jwt:Audience               - JWT audience (default: LukesGuitarShopUsers)
Jwt:ExpirationDays         - Token expiration in days (default: 7)
Seller:Email               - Seller's email address for messaging (default: lukesguitarshop@gmail.com)
Seller:Name                - Seller's display name (default: Luke's Guitar Shop)
Email:SmtpHost             - SMTP server hostname (default: smtp.gmail.com)
Email:SmtpPort             - SMTP server port (default: 587)
Email:SmtpUsername         - SMTP authentication username
Email:SmtpPassword         - SMTP authentication password (app password for Gmail)
Email:FromEmail            - From email address (defaults to SmtpUsername)
Email:FromName             - From display name (default: Luke's Guitar Shop)
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
NEXT_PUBLIC_PAYPAL_CLIENT_ID=<your-paypal-client-id>
```

---

## Local Development Setup

### 1. Backend

```bash
cd G:\Projects\lgs\backend\GuitarDb.API
dotnet run
```

Runs on `http://localhost:5000`

### 2. Frontend

```bash
cd G:\Projects\lgs\frontend
npm run dev
```

Runs on `http://localhost:3000`

### 3. Required Configuration Files

| File | Purpose | Git Ignored |
|------|---------|-------------|
| `backend/GuitarDb.API/appsettings.Development.json` | Dev secrets (Stripe, PayPal, MongoDB) | Yes |
| `frontend/.env.local` | Frontend env vars (API URL, PayPal Client ID) | Yes |

### 4. Getting PayPal Sandbox Credentials

1. Go to https://developer.paypal.com/dashboard/applications/sandbox
2. Create app or use default sandbox app
3. Copy Client ID → `appsettings.Development.json` + `.env.local`
4. Copy Secret → `appsettings.Development.json` only
5. Create sandbox buyer account at https://developer.paypal.com/dashboard/accounts for testing

---

## Files Protected by .gitignore

The following sensitive files are excluded from git:

- `appsettings.Development.json` - Backend secrets
- `.env.local` - Frontend secrets
- `appsettings.*.json` - All environment-specific configs
