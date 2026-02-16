# LGS Manual Testing Checklist
0 = needs fixed
1 = done

## Prerequisites

- [1] Backend running on `http://localhost:5000`
- [1] Frontend running on `http://localhost:3000`
- [1] MongoDB connected with test data
- [1] At least one admin user account
- [1] At least one regular user account
- [1] At least one active listing available

---

## E2E Automated Tests (Playwright)

The E2E test suite covers the main user flows. Run with:

```bash
cd frontend
npm run test:e2e        # Run all tests headless
npm run test:e2e:ui     # Run with UI mode for debugging
```

### Test Coverage (73 tests)
- **Authentication** (9 tests): Login modal, login/logout flow, profile dropdown
- **Listings** (16 tests): Browse, search, filter, listing detail
- **Cart** (8 tests): Add/remove items, checkout navigation
- **Favorites** (5 tests): Add/remove favorites, unauthenticated prompts
- **Offers** (6 tests): Make offer modal, offers page
- **Checkout** (6 tests): Auth requirements, checkout flow
- **Messages** (5 tests): Message seller, conversations
- **Admin** (5 tests): Access control, admin dashboard
- **Edge Cases** (13 tests): 404 pages, navigation, mobile, sessions

### Test Users Required
- `testuser@lgs.com` / `TestPassword123!` - Regular user
- `testadmin@lgs.com` / `TestPassword123!` - Admin user

---

## 1. Authentication

### 1.1 Registration
- [1] Navigate to home page, click Login
- [1] Click "Create account" link
- [1] Submit with invalid email → error shown
- [1] Submit with short password → error shown
- [1] Submit with valid data → account created, logged in
- [1] Profile button shows user name

features to add: 
send email verification upon first account creation. Do not create the account until verification passes.
toggle eye to view password on both password and confirm password form fields.


### 1.2 Login
- [1] Click Login, enter wrong password → error shown
- [1] Enter correct credentials → logged in
- [1] JWT token stored in localStorage
- [1] Refresh page → still logged in

features to add: 
forgot password? button that sends a reset link to the email.

### 1.3 Logout
- [1] Click profile dropdown → Logout
- [1] Token cleared, redirected appropriately
- [1] Protected pages redirect to login

### 1.4 Guest Session
- [1] Log out, add item to cart
- [1] Proceed to checkout as guest
- [1] Guest session created in DB

features to add:
remove all guest session code. Now when checking out require an account to be created.

---

## 2. Listings & Search

### 2.1 Browse Listings
- [1] Home page loads listing grid
- [1] Images display correctly
- [1] Prices and conditions shown
- [1] Disabled listings NOT shown to regular users

### 2.2 Search & Filter
- [1] Type in search box → results filter
- [1] Filter by condition → only matching shown
- [1] Set price range → results filter correctly
- [1] Sort by price low/high → order correct
- [1] Sort by newest → order correct
- [1] Clear filters → all listings shown

### 2.3 Mobile Filters
- [1] On mobile viewport, "Filter" button visible
- [1] Tap Filter → navigates to /filter page
- [1] Apply filters → redirects to home with URL params
- [1] URL params persist on refresh

features to add:
clear all filters on the /filter mobile page button needs to be solid white not transparent

### 2.4 Listing Detail
- [1] Click listing → detail page loads
- [1] All images display in gallery
- [1] Description renders correctly
- [1] Price and condition shown
- [1] "Add to Cart" button visible
- [1] "Make Offer" button visible (when logged in)
- [1] "Message Seller" button visible (when logged in)

---

## 3. Favorites

### 3.1 Add Favorite
- [1] Login as regular user
- [1] Go to listing detail
- [1] Click heart icon → turns filled/red
- [1] Favorite saved to DB

### 3.2 View Favorites
- [1] Navigate to /favorites
- [1] Favorited listing appears in list
- [1] Click listing → goes to detail

features to add:
/features page preview listing image not loading properly

### 3.3 Remove Favorite
- [1] On favorites page, click remove/heart
- [1] Item removed from list
- [1] Refresh → item still removed

### 3.4 Unauthenticated
- [1] Log out
- [1] Try to favorite → prompted to login

---

## 4. Shopping Cart

### 4.1 Add to Cart
- [1] Click "Add to Cart" on listing
- [1] Toast/notification confirms add
- [1] Cart badge updates in header
- [1] Same item cannot be added twice

### 4.2 View Cart
- [1] Navigate to /cart
- [1] Item shows with image, title, price
- [1] Total calculated correctly

### 4.3 Remove from Cart
- [1] Click trash/remove icon
- [1] Item removed
- [1] Total updates
- [1] Cart badge updates

### 4.4 Empty Cart
- [1] Remove all items
- [1] "Your cart is empty" message shown
- [1] Link to continue shopping

---

## 5. Offers System (Buyer)

### 5.1 Make Offer
- [1] Login as regular user
- [1] Go to listing detail
- [1] Click "Make Offer"
- [1] Modal opens with listing info
- [1] Enter offer amount below listing price
- [1] Submit → offer created
- [1] Success message shown

features to add:
set a cap of 5 character length to make an offer dialogue (no more than 99999 offer)
if an offer is attempted to be made twice on the guitar while one is already pending make sure it says "you already have an offer on that guitar" or something)


### 5.2 View My Offers
- [1] Navigate to /offers
- [1] Offer appears in list
- [1] Status shows "Pending"
- [1] Filter by status works

### 5.3 Offer Detail
- [1] Click offer → detail page
- [1] Shows listing info
- [1] Shows offer history/timeline
- [1] Shows current status

features to add:
Right now the listing detail page has a "back to listings" button at the top that links to the homepage. I want that to be more dynamic. If you go to the listing details page I want that to act as more of a previous page button.

### 5.4 Respond to Counter-Offer
- [1] Have admin counter the offer (see Admin section)
- [ ] Refresh offers page
- [ ] Status shows "Countered"
- [ ] Click offer → see counter amount
- [ ] "Accept" and "Reject" buttons visible
- [ ] Click Accept → status changes to "Accepted"
- [ ] Message shows "Item added to cart"
- [ ] "Go to Cart" link visible

features to add:

after the admin counters an offer, remove the accept button.
when the admin page is refreshed, make sure that it stays on whatever tab it is. for example if I refresh on the offer tab make sure it stays.

### 5.5 Reject Counter-Offer
- [1] Make new offer, have admin counter
- [1] Click Reject
- [1] Status changes to "Rejected"

---

## 6. Locked Cart Items (New Feature)
works perfect

### 6.1 Auto-Add on Offer Acceptance
- [1] Accept a counter-offer (or have admin accept your offer)
- [1] Navigate to /cart
- [1] Item appears with lock icon
- [1] Price matches accepted offer amount
- [1] Info banner explains locked items

features to add:

remove the "this listing has already been sold" on the offer detail page for a regular user after they accept the sellers offer.
make sure the toast notification auto refreshes to reflect the correct amount of item in the cart after the rtegular user accepts a counter offer from the seller.

### 6.2 Cannot Remove Locked Items
- [1] Try to click remove on locked item
- [1] Item remains in cart
- [1] No trash icon (lock icon instead)

### 6.3 Locked + Regular Items
- [1] Add regular item to cart
- [1] Both items display
- [1] Regular item has trash icon (removable)
- [1] Locked item has lock icon (not removable)
- [1] Total includes both

### 6.4 Listing Disabled
- [1] After offer accepted, check listing
- [1] Listing should be disabled (not visible to others)
- [1] Direct URL still works but shows disabled state

---

## 7. Checkout

### 7.1 Stripe Checkout
- [1] Add items to cart
- [1] Go to /checkout
- [1] Fill shipping address
- [1] Select "Credit Card"
- [1] Click checkout → redirected to Stripe
- [1] Use test card 4242424242424242
- [1] Complete payment
- [1] Redirected to success page
- [1] Order confirmation shown

features to add:

change the shipping address to an account based shipping address. I want a button that says: create a new saved address if nothing has been created. if there is already a saved address mnake it clickable. make the stripe button the same as paypal where it is greyed out if no saved address entered. Make sure the saved addres fields are the same and still send meta data to stripe and paypal works properly and the orders are all saved the same.

### 7.2 PayPal Checkout
- [1] Add items to cart
- [1] Go to /checkout
- [1] Fill shipping address
- [1] Select "PayPal"
- [1] PayPal button appears
- [1] Click → PayPal popup
- [1] Login with sandbox account
- [1] Approve payment
- [1] Redirected to success page

### 7.3 Checkout with Locked Items
- [1] Have locked item in cart (from accepted offer)
- [1] Complete checkout (Stripe or PayPal)
- [1] Order created with correct price
- [1] Pending cart item removed from DB
- [1] Listing remains disabled

features to add:

remove notification caused by pending cart item after checkout without having to refresh



### 7.5 Saved Shipping Address
- [0] Login as user with saved address
- [0] Go to checkout
- [0] Address pre-filled
- [0] Checkbox to save address works

wait to test after with the features mentioned above

---

## 8. Order History

### 8.1 View Orders
- [1] Login as user who made orders
- [1] Go to /profile
- [1] Order history section visible
- [1] Orders show date, total, status

features to add:

order shows the original price of the guitar, not the offer accpeted price on the user profile page and the admin page aswell

### 8.2 Order Details
- [1] Click order → details expand/show
- [1] Items listed with prices
- [1] Shipping address shown


---

## 9. Messages

### 9.1 Contact Seller
- [1] Login as regular user
- [1] Go to listing detail
- [1] Click "Message Seller"
- [1] Message modal/page opens
- [1] Type message, send
- [1] Conversation created

### 9.2 View Conversations
- [1] Navigate to /messages
- [1] Conversation appears in list
- [1] Shows last message preview
- [1] Unread indicator if applicable

features to add:

error when attempting to message from listing detail page
"## Error Type
Console Error

## Error Message
Failed to fetch listing price: {}


    at ConversationPage.useEffect.fetchListingPrice (app/messages/[conversationId]/page.tsx:122:17)

## Code Frame
  120 |         setListingPrice({ price: listing.price, currency: listing.currency });
  121 |       } catch (error) {
> 122 |         console.error('Failed to fetch listing price:', error);
      |                 ^
  123 |       }
  124 |     };
  125 |

Next.js version: 16.1.1 (Turbopack)
"



### 9.3 Chat
- [1] Click conversation
- [1] Message history loads
- [1] Send new message
- [1] Message appears in thread
- [1] Polling updates work (wait 5s for admin reply)

### 9.4 Notifications
- [1] Have admin send message
- [1] Profile button shows notification badge
- [1] Dropdown shows message count
- [1] Click → goes to messages


---

## 10. Admin Portal

### 10.1 Access
- [1] Login as admin user
- [1] Profile dropdown shows "Admin Portal"
- [1] Click → navigates to /admin
- [1] All tabs visible (Scraper, Offers, Messages, Listings, Orders)

### 10.2 Offers Tab
- [1] View all customer offers
- [1] Filter by status (Pending, Countered, Accepted, Rejected)
- [1] Filter by listing
- [1] See buyer name and email

### 10.3 Counter Offer
- [1] Find pending offer
- [1] Enter counter amount
- [1] Submit counter-offer
- [1] Status changes to "Countered"

### 10.4 Accept Offer (Admin)
- [1] Find pending offer
- [1] Click Accept
- [1] Status changes to "Accepted"
- [1] Listing disabled automatically
- [1] Pending cart item created for buyer
- [1] Verify: Login as buyer → item in cart (locked)

### 10.5 Reject Offer
- [1] Find pending offer
- [1] Click Reject
- [1] Status changes to "Rejected"

### 10.6 Messages Tab
- [1] View customer conversations
- [1] Unread count displayed
- [1] Listing context shown (if applicable)
- [1] Quick reply works
- [1] "View Full Chat" link works

### 10.7 Listings Tab
- [1] View all listings
- [1] Edit price works
- [1] Disable/enable toggle works
- [1] Disabled listings show indicator

### 10.8 Orders Tab (New Feature)
- [1] Click Orders tab
- [1] All orders displayed
- [1] Shows: Order ID, Date, Buyer, Items, Total, Payment Method, Status ------- total is incorrect for accepted offer as stated above
- [1] Buyer name and email visible
- [1] Items show thumbnails
- 1 ] Shipping address expandable

### 10.9 Pending Cart Items (Admin View)
- [0] After accepting offer, check admin can see pending cart item
- [0] Buyer info displayed
- [0] Expiry time shown

### 10.10 Cancel Pending Cart Item
- [0] Find pending cart item
- [0] Click Cancel/Delete
- [0] Item removed
- [0] Listing re-enabled
- [0] Verify: Buyer's cart no longer has locked item

---

## 11. Edge Cases & Error Handling

### 11.1 Offer on Disabled Listing
- [1] Disable a listing
- [1] Try to make offer → should be prevented

### 11.2 Checkout Disabled Item
- [0] Add item to cart
- [0] Admin disables listing
- [0] Try checkout → appropriate error


features to add:
when I sign out with something in the cart it should remove from cart.


### 11.3 Expired Pending Cart Item
- [0] Accept offer to create pending cart item
- [0] In DB, manually set expires_at to past
- [0] Wait for TTL cleanup (or trigger manually)
- [0] Item should be removed from buyer's cart
- [0] (Note: Listing re-enable may need manual step)

### 11.4 Network Errors
- [1] Stop backend
- [1] Try actions → appropriate error messages shown
- [1] No crashes or blank screens

### 11.5 Concurrent Offer Accept
- [1] Two users have offers on same listing
- [1]Accept one → listing disabled
- [1] Second user tries to checkout accepted offer
- [0] Should handle gracefully

features to add:

when the seller accepts one offer from a user when it has two offers of the same listing, in the manage offer page in the admin portal, on that second offer that wasnt accepted, the card needs to automattically reject and auto refresh when the other one is acceopted so the seller cant accept two different offer on the same guitar. That means removing the accept counter reject button. it should act the same as if I clicked reject on the second offer component.

