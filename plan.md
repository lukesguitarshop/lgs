# LGS Bug Fixes & Features Plan

## Technical Rules

- **Read codebase.md before every step** - understand project structure and patterns
- **Light mode only** - do not add dark mode classes to new features
- Backend validates all data server-side (security)
- Use existing API patterns from listings endpoints
- Match existing styling/theming conventions

**Project path:** G:/projects/lgs/

---

## Step 1: Add Password Visibility Toggle

**Objective:** Add toggle eye icon to show/hide password on registration and login forms.

**Files to Modify:**
- `frontend/components/auth/LoginModal.tsx`
- `frontend/components/auth/RegisterModal.tsx`

**Changes:**
1. Import `Eye` and `EyeOff` icons from lucide-react
2. Add state `showPassword` (and `showConfirmPassword` for register)
3. Change input type dynamically based on state
4. Add clickable eye icon button inside input field
5. Style to match existing form inputs

**After Completion:**
- [ ] Update plan.md marking Step 1 complete
- [ ] Stop for /clear

---

## Step 2: Add Forgot Password Functionality

**Objective:** Add "Forgot password?" link that sends a reset link to user's email.

**Files to Modify:**
- `frontend/components/auth/LoginModal.tsx`
- `backend/GuitarDb.API/Controllers/AuthController.cs`
- `backend/GuitarDb.API/Services/AuthService.cs`
- `backend/GuitarDb.API/Services/EmailService.cs`

**Files to Create:**
- `frontend/app/reset-password/page.tsx`
- `backend/GuitarDb.API/Models/PasswordResetToken.cs`

**Changes:**
1. Add PasswordResetToken model with token, userId, expiresAt
2. Add collection and methods in MongoDbService
3. Add `POST /api/auth/forgot-password` endpoint - generates token, sends email
4. Add `POST /api/auth/reset-password` endpoint - validates token, updates password
5. Add "Forgot password?" link in LoginModal
6. Create reset-password page with new password form

**After Completion:**
- [ ] Update plan.md marking Step 2 complete
- [ ] Update codebase.md with new endpoints
- [ ] Stop for /clear

---

## Step 3: Add Email Verification on Registration

**Objective:** Require email verification before account is fully created.

**Files to Modify:**
- `frontend/components/auth/RegisterModal.tsx`
- `backend/GuitarDb.API/Controllers/AuthController.cs`
- `backend/GuitarDb.API/Services/MongoDbService.cs`
- `backend/GuitarDb.API/Models/User.cs`

**Files to Create:**
- `frontend/app/verify-email/page.tsx`
- `backend/GuitarDb.API/Models/EmailVerificationToken.cs`

**Changes:**
1. Add EmailVerificationToken model
2. Add `email_verified` field to User model (default false)
3. Modify register to send verification email instead of immediate login
4. Add `POST /api/auth/verify-email` endpoint
5. Create verify-email page that handles token from URL
6. Block login for unverified accounts with helpful message

**After Completion:**
- [ ] Update plan.md marking Step 3 complete
- [ ] Update codebase.md with changes
- [ ] Stop for /clear

---

## Step 4: Remove Guest Checkout - Require Account

**Objective:** Remove all guest session code and require account creation for checkout.

**Files to Modify:**
- `frontend/app/checkout/page.tsx`
- `backend/GuitarDb.API/Controllers/CheckoutController.cs`
- `backend/GuitarDb.API/Controllers/AuthController.cs`
- `backend/GuitarDb.API/Services/MongoDbService.cs`

**Changes:**
1. Remove guest session creation endpoint
2. Remove guest checkout flow from frontend
3. Add login/register prompt on checkout page if not authenticated
4. Remove `guest_session_id` and `guest_email` handling from checkout endpoints
5. Clean up related guest session code in MongoDbService
6. Keep order `user_id` as required field

**After Completion:**
- [ ] Update plan.md marking Step 4 complete
- [ ] Update codebase.md removing guest references
- [ ] Stop for /clear

---

## Step 5: Fix Mobile Filter Clear Button Styling

**Objective:** Make "Clear all filters" button on mobile /filter page solid white instead of transparent.

**Files to Modify:**
- `frontend/app/filter/page.tsx`

**Changes:**
1. Find the "Clear all filters" button
2. Change background from transparent to solid white
3. Ensure text remains readable (dark text on white)
4. Match overall styling of the filter page

**After Completion:**
- [ ] Update plan.md marking Step 5 complete
- [ ] Stop for /clear

---

## Step 6: Fix Favorites Page Image Loading

**Objective:** Fix preview listing image not loading properly on /favorites page.

**Files to Modify:**
- `frontend/app/favorites/page.tsx`

**Changes:**
1. Debug image URL source
2. Ensure images array is properly accessed
3. Add fallback for missing images
4. Match image loading pattern from other listing displays

**After Completion:**
- [ ] Update plan.md marking Step 6 complete
- [ ] Stop for /clear

---

## Step 7: Add Offer Amount Validation

**Objective:** Cap offer amount to 5 digits (max $99,999) and prevent duplicate offers on same listing.

**Files to Modify:**
- `frontend/components/offers/MakeOfferModal.tsx`
- `backend/GuitarDb.API/Controllers/OffersController.cs`

**Changes:**
1. Add maxLength={5} to offer input field
2. Add frontend validation for max value 99999
3. Backend: Check for existing pending/countered offer by same user on same listing
4. Return error "You already have an active offer on this guitar" if duplicate
5. Show appropriate error message in modal

**After Completion:**
- [ ] Update plan.md marking Step 7 complete
- [ ] Stop for /clear

---

## Step 8: Add Dynamic Back Button on Listing Detail

**Objective:** Replace static "Back to Listings" with browser history back navigation.

**Files to Modify:**
- `frontend/app/listing/[id]/page.tsx` or `ListingDetail.tsx`

**Changes:**
1. Import `useRouter` from next/navigation
2. Replace Link with button that calls `router.back()`
3. Keep same styling as current button
4. Fallback to home if no history

**After Completion:**
- [ ] Update plan.md marking Step 8 complete
- [ ] Stop for /clear

---

## Step 9: Persist Admin Portal Tab on Refresh

**Objective:** Keep admin portal on current tab when page is refreshed.

**Files to Modify:**
- `frontend/app/admin/page.tsx`

**Changes:**
1. Store active tab in URL query param or localStorage
2. Read tab from storage on page load
3. Update storage when tab changes
4. Default to first tab if no stored value

**After Completion:**
- [ ] Update plan.md marking Step 9 complete
- [ ] Stop for /clear

---

## Step 10: Remove Accept Button After Admin Counter-Offer

**Objective:** After admin counters an offer, buyer should only see Reject button (not Accept).

**Files to Modify:**
- `frontend/app/offers/[offerId]/page.tsx`

**Changes:**
1. When offer status is "Countered", hide Accept button
2. Show only Reject button
3. Add message explaining buyer can reject and make new offer
4. Update UI to reflect this flow

**After Completion:**
- [ ] Update plan.md marking Step 10 complete
- [ ] Stop for /clear

---

## Step 11: Remove "Listing Sold" Message After Buyer Accepts

**Objective:** Remove "This listing has already been sold" message on offer detail page after buyer accepts counter-offer.

**Files to Modify:**
- `frontend/app/offers/[offerId]/page.tsx`

**Changes:**
1. Check if current user is the buyer of the accepted offer
2. If so, don't show the "sold" message
3. Show "Go to Cart" link instead
4. Keep sold message for other scenarios

**After Completion:**
- [ ] Update plan.md marking Step 11 complete
- [ ] Stop for /clear

---

## Step 12: Update Cart Badge After Accepting Counter-Offer

**Objective:** Cart badge in header should refresh immediately when buyer accepts counter-offer.

**Files to Modify:**
- `frontend/app/offers/[offerId]/page.tsx`
- `frontend/contexts/AuthContext.tsx` or cart context

**Changes:**
1. After successful accept, trigger cart count refresh
2. Either dispatch event or call cart refresh function
3. Ensure header cart badge updates without page reload
4. Toast notification should show updated count

**After Completion:**
- [ ] Update plan.md marking Step 12 complete
- [ ] Stop for /clear

---

## Step 13: Implement Account-Based Saved Shipping Address

**Objective:** Replace inline shipping form with saved address system.

**Files to Modify:**
- `frontend/app/checkout/page.tsx`
- `frontend/app/profile/page.tsx`
- `backend/GuitarDb.API/Controllers/AuthController.cs`

**Changes:**
1. If no saved address: show "Create a new saved address" button
2. Button opens address form modal
3. Save address to user profile via API
4. If address exists: show address card (clickable to edit)
5. Grey out Stripe button (like PayPal) until address is saved
6. Ensure address metadata sent correctly to both Stripe and PayPal
7. Orders continue to store shipping address the same way

**After Completion:**
- [ ] Update plan.md marking Step 13 complete
- [ ] Update codebase.md with checkout changes
- [ ] Stop for /clear

---

## Step 14: Remove Pending Cart Notification After Checkout

**Objective:** Clear pending cart notification immediately after checkout without requiring refresh.

**Files to Modify:**
- `frontend/app/checkout/success/page.tsx`
- `frontend/lib/notifications.ts`

**Changes:**
1. After successful checkout, trigger notification refresh
2. Clear any cached pending cart item counts
3. Update notification badge in header
4. Ensure polling picks up cleared state

**After Completion:**
- [ ] Update plan.md marking Step 14 complete
- [ ] Stop for /clear

---

## Step 15: Fix Order Price Display for Accepted Offers

**Objective:** Show accepted offer price instead of original listing price in order history.

**Files to Modify:**
- `frontend/app/profile/page.tsx`
- `frontend/app/admin/page.tsx`
- `backend/GuitarDb.API/Controllers/AdminController.cs` (if needed)

**Changes:**
1. Orders already store the correct price from checkout
2. Verify order items use the price from PendingCartItem (offer price)
3. Fix any display logic showing wrong price
4. Update admin orders tab to show correct amount
5. Verify total calculation uses correct item prices

**After Completion:**
- [ ] Update plan.md marking Step 15 complete
- [ ] Stop for /clear

---

## Step 16: Fix Messages Fetch Listing Price Error

**Objective:** Fix "Failed to fetch listing price" error when messaging from listing detail page.

**Files to Modify:**
- `frontend/app/messages/[conversationId]/page.tsx`

**Changes:**
1. Debug the fetchListingPrice function at line 122
2. Handle case where listing doesn't exist or is null
3. Add proper error handling for missing listing
4. Ensure conversation still works without listing price

**After Completion:**
- [ ] Update plan.md marking Step 16 complete
- [ ] Stop for /clear

---

## Step 17: Clear Cart on Sign Out

**Objective:** Remove all items from cart when user logs out.

**Files to Modify:**
- `frontend/contexts/AuthContext.tsx`
- `frontend/lib/cart.ts`

**Changes:**
1. In logout function, call clearCart()
2. Clear localStorage cart items
3. Reset any cart state/context
4. Ensure cart badge updates to 0

**After Completion:**
- [ ] Update plan.md marking Step 17 complete
- [ ] Stop for /clear

---

## Step 18: Auto-Reject Other Offers When One is Accepted

**Objective:** When seller accepts one offer on a listing, automatically reject all other pending offers on that listing.

**Files to Modify:**
- `backend/GuitarDb.API/Controllers/OffersController.cs`
- `backend/GuitarDb.API/Controllers/AdminController.cs`
- `backend/GuitarDb.API/Services/MongoDbService.cs`

**Changes:**
1. Add method `RejectAllOtherOffersOnListingAsync(listingId, acceptedOfferId)`
2. In AcceptOffer (both user and admin), after accepting:
   - Get all other offers on the same listing
   - Set their status to "Rejected"
   - Add system message "This offer was automatically rejected because another offer was accepted"
3. Send rejection email notifications to those buyers
4. Frontend will show rejected status on refresh

**After Completion:**
- [ ] Update plan.md marking Step 18 complete
- [ ] Update codebase.md with new method
- [ ] Stop for /clear

---

## Current Status

- [x] Step 1: Add Password Visibility Toggle
- [x] Step 2: Add Forgot Password Functionality
- [x] Step 3: Add Email Verification on Registration
- [x] Step 4: Remove Guest Checkout - Require Account
- [x] Step 5: Fix Mobile Filter Clear Button Styling
- [x] Step 6: Fix Favorites Page Image Loading
- [x] Step 7: Add Offer Amount Validation
- [x] Step 8: Add Dynamic Back Button on Listing Detail
- [x] Step 9: Persist Admin Portal Tab on Refresh
- [x] Step 10: Remove Accept Button After Admin Counter-Offer
- [x] Step 11: Remove "Listing Sold" Message After Buyer Accepts
- [x] Step 12: Update Cart Badge After Accepting Counter-Offer
- [x] Step 13: Implement Account-Based Saved Shipping Address
- [x] Step 14: Remove Pending Cart Notification After Checkout
- [x] Step 15: Fix Order Price Display for Accepted Offers
- [x] Step 16: Fix Messages Fetch Listing Price Error
- [x] Step 17: Clear Cart on Sign Out
- [x] Step 18: Auto-Reject Other Offers When One is Accepted

**All steps completed!**
