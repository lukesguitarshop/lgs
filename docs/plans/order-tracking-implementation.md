# Order Tracking Implementation Plan

## Overview
Add ability for admin to add tracking information (carrier + tracking number) to orders, visible to users in their order history.

## Files to Modify

### Backend

1. **`backend/GuitarDb.API/Models/Order.cs`**
   - Add `TrackingCarrier` field (string, nullable)
   - Add `TrackingNumber` field (string, nullable)

2. **`backend/GuitarDb.API/Services/MongoDbService.cs`**
   - Add `UpdateOrderTrackingAsync(string orderId, string? carrier, string? trackingNumber)` method

3. **`backend/GuitarDb.API/Controllers/AdminController.cs`**
   - Add `PATCH /admin/orders/{id}/tracking` endpoint
   - Add `UpdateOrderTrackingRequest` DTO class
   - Update `AdminOrderDto` to include `TrackingCarrier` and `TrackingNumber`
   - Update `GetAllOrdersForAdmin` to map tracking fields

4. **`backend/GuitarDb.API/Controllers/AuthController.cs`**
   - Update `OrderSummaryDto` to include `TrackingCarrier` and `TrackingNumber`
   - Update orders mapping in `GetUserOrders` endpoint

### Frontend

5. **`frontend/app/admin/page.tsx`**
   - Update `AdminOrder` interface to include `trackingCarrier` and `trackingNumber`
   - Add tracking UI in orders table:
     - New "Tracking" column
     - Expandable row or inline edit with:
       - Dropdown for carrier (UPS, USPS, FedEx)
       - Text input for tracking number
       - Save button
   - Add `updateOrderTracking` function to call the API

6. **`frontend/app/profile/page.tsx`**
   - Update `Order` interface to include `trackingCarrier` and `trackingNumber`
   - Display tracking info in order history when available
   - Show carrier name and tracking number (optionally as clickable link)

## Implementation Details

### Order Model Changes
```csharp
[BsonElement("tracking_carrier")]
[BsonIgnoreIfNull]
public string? TrackingCarrier { get; set; }

[BsonElement("tracking_number")]
[BsonIgnoreIfNull]
public string? TrackingNumber { get; set; }
```

### Carrier Options
- UPS
- USPS
- FedEx

### Tracking Links (Optional Enhancement)
- UPS: `https://www.ups.com/track?tracknum={number}`
- USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels={number}`
- FedEx: `https://www.fedex.com/fedextrack/?trknbr={number}`

## Verification
1. Build backend: `cd backend/GuitarDb.API && dotnet build`
2. Build frontend: `cd frontend && npm run build`
3. Test flow:
   - Create an order (or use existing)
   - As admin, go to Admin Portal > Orders tab
   - Add tracking carrier and number to an order
   - As user, go to Profile > Order History
   - Verify tracking info is displayed
