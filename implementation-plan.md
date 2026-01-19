# Stripe Checkout with Cart Feature - Implementation Plan

## Overview
Implement a shopping cart system with Stripe checkout integration for the guitar listings.

---

## Step 1: Stripe Checkout Endpoint (Backend)
- [x] Install Stripe NuGet package in GuitarDb.API
- [x] Add Stripe configuration to appsettings.json
- [x] Create CheckoutController with POST endpoint
- [x] Accept cart items (listing IDs + quantities)
- [x] Fetch listing details from MongoDB for prices
- [x] Create Stripe checkout session with line items
- [x] Return session URL to frontend

**Stripe Test Key:** (stored locally, not committed)

---

## Step 2: Success/Cancel Pages (Frontend)
- [x] Create `/checkout/success/page.tsx` - thank you page after successful payment
- [x] Create `/checkout/cancel/page.tsx` - page shown when user cancels checkout
- [x] Clear cart on success page load

---

## Step 3: Checkout Page (Frontend)
- [x] Create `/checkout/page.tsx`
- [x] Display cart summary (items, prices, total)
- [x] "Pay with Stripe" button that calls backend checkout endpoint
- [x] Redirect to Stripe checkout session URL
- [x] Handle loading/error states

---

## Step 4: Cart Page (Frontend)
- [x] Create `/cart/page.tsx`
- [x] Display cart items from localStorage
- [x] Show item image, title, price for each item
- [x] Remove item button for each item
- [x] Display total price
- [x] "Proceed to Checkout" button linking to /checkout
- [x] Empty cart state

---

## Step 5: Cart State Management (Frontend)
- [x] Create `lib/cart.ts` with cart utility functions
- [x] `getCart()` - get cart items from localStorage
- [x] `addToCart(listing)` - add item to cart
- [x] `removeFromCart(listingId)` - remove item from cart
- [x] `clearCart()` - empty the cart
- [x] `getCartCount()` - get number of items
- [x] `getCartTotal()` - calculate total price
- [x] Cart item interface: `{ id, title, price, currency, image }`

---

## Step 6: Add to Cart Button (Frontend)
- [x] Update ListingDetail.tsx
- [x] Replace disabled "Add to Cart" button with functional one
- [x] On click, save listing to localStorage cart
- [x] Show toast/feedback on add
- [x] Optional: "Added to cart" state change

---

## Step 7: Cart Icon in Header (Frontend)
- [x] Add cart icon to site header/navbar
- [x] Display item count badge from localStorage
- [x] Link to /cart page
- [x] Update count reactively when items added

---

## Step 8: Configure Stripe Secret Key for Sandbox Testing
- [x] Go to https://dashboard.stripe.com/test/apikeys
- [x] Copy the Secret Key (stored in appsettings.json)
- [x] Add to appsettings.json in GuitarDb.API
- [x] Verify CheckoutController uses SecretKey for Stripe initialization
- [x] Test checkout session creation works
- [x] Verify test mode (sandbox) - no real charges

---

## Step 9: Admin Portal - Manual Scraper Trigger
- [x] Create `/admin/page.tsx` - admin portal page
- [x] Add "Run Scraper" button
- [x] Create backend endpoint POST `/api/admin/run-scraper`
- [x] Endpoint triggers the scraper logic manually
- [x] Show loading state while scraper runs
- [x] Display success/error feedback
- [x] Optional: Show scraper progress/results
- [x] Add small "Admin" link in footer next to Home and Search
- [x] Admin link opens login prompt
- [x] Add password protection (username: lukeydude17, password: DallasCowboys88!)
- [x] Protect admin page with auth check

---

## Step 10: Commit and Push to GitHub
- [x] Commit all frontend changes
- [x] Push to GitHub

---

## Technical Notes
- Use localStorage for cart persistence (no auth required)
- Stripe test mode for development
- Backend validates prices server-side (security)
- Cart stored as JSON array of listing objects


do /clear at the end of each step and check of the step boxes
