# Order Cancellation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Cancel Order button in the admin panel that marks an order as cancelled and emails the buyer that their order was cancelled and their refund is processing.

**Architecture:** Extend the existing `PATCH /admin/orders/{id}/status` endpoint to accept `"cancelled"`, fire a cancellation email when set (mirroring the shipped-email pattern in `UpdateOrderTracking`), and add Cancel/Restore buttons with a red badge in the admin orders table.

**Tech Stack:** C# / ASP.NET Core (backend), Next.js / React / TypeScript (frontend), SMTP via `EmailService`

---

### Task 1: Add `SendOrderCancellationEmailAsync` to EmailService

**Files:**
- Modify: `backend/GuitarDb.API/Services/EmailService.cs` (after `SendOrderConfirmationToBuyerAsync`, around line 645)

**Step 1: Add the method**

Insert this method after `SendOrderConfirmationToBuyerAsync`:

```csharp
/// <summary>
/// Send cancellation email to buyer
/// </summary>
public async Task SendOrderCancellationEmailAsync(
    string buyerEmail,
    string orderId,
    List<(string Title, decimal Price, string Currency)> items,
    decimal totalAmount)
{
    if (!_isEnabled || string.IsNullOrEmpty(buyerEmail))
    {
        _logger.LogDebug("Skipping order cancellation email - email not configured");
        return;
    }

    var subject = "Your Order Has Been Cancelled – Luke's Guitar Shop";

    var itemsList = string.Join("", items.Select(i =>
        $"<li><strong>{i.Title}</strong> - ${i.Price:N2} {i.Currency}</li>"));

    var body = $@"
<h2>Your Order Has Been Cancelled</h2>
<p>We're sorry to let you know that your order has been cancelled.</p>

<h3>Order Details</h3>
<p><strong>Order Reference:</strong> #{orderId[^8..].ToUpper()}</p>

<h3>Items</h3>
<ul>
{itemsList}
</ul>

<p><strong>Total:</strong> ${totalAmount:N2}</p>

<h3>Refund</h3>
<p>Your refund is being processed and should appear within 5–10 business days depending on your payment method and bank.</p>

<p>If you have any questions, please don't hesitate to contact us.</p>

<hr>
<p style=""color: #666; font-size: 12px;"">This is an automated message from Luke's Guitar Shop.</p>
";

    await SendEmailAsync(buyerEmail, subject, body);
}
```

**Step 2: Build the backend to confirm no compile errors**

```bash
cd backend/GuitarDb.API
dotnet build
```

Expected: Build succeeded, 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Services/EmailService.cs
git commit -m "feat(orders): add SendOrderCancellationEmailAsync to EmailService"
```

---

### Task 2: Extend UpdateOrderStatus to handle "cancelled"

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs` (around line 672)

**Step 1: Update the status endpoint**

Replace the `UpdateOrderStatus` method body (lines ~673–688) with:

```csharp
[HttpPatch("orders/{id}/status")]
public async Task<IActionResult> UpdateOrderStatus(string id, [FromBody] UpdateOrderStatusRequest request)
{
    var validStatuses = new[] { "completed", "shipped", "delivered", "pending", "cancelled" };
    if (string.IsNullOrEmpty(request.Status) || !validStatuses.Contains(request.Status.ToLower()))
    {
        return BadRequest(new { error = "Invalid status. Valid values: completed, shipped, delivered, pending, cancelled" });
    }

    var newStatus = request.Status.ToLower();

    // Fetch order before updating (needed for cancellation email)
    var order = await _mongoDbService.GetOrderByIdAsync(id);
    if (order == null)
    {
        return NotFound(new { error = "Order not found" });
    }

    var success = await _mongoDbService.UpdateOrderStatusAsync(id, newStatus);
    if (!success)
    {
        return NotFound(new { error = "Order not found" });
    }

    // Send cancellation email when order is cancelled
    if (newStatus == "cancelled")
    {
        string? buyerEmail = null;

        if (!string.IsNullOrEmpty(order.UserId))
        {
            var user = await _mongoDbService.GetUserByIdAsync(order.UserId);
            buyerEmail = user?.Email;
        }
        else if (!string.IsNullOrEmpty(order.GuestEmail))
        {
            buyerEmail = order.GuestEmail;
        }

        if (!string.IsNullOrEmpty(buyerEmail))
        {
            var items = order.Items.Select(i => (i.ListingTitle, i.Price, order.Currency)).ToList();
            _ = _emailService.SendOrderCancellationEmailAsync(
                buyerEmail,
                order.Id!,
                items,
                order.TotalAmount
            );
        }
    }

    return Ok(new { success = true });
}
```

**Step 2: Build to confirm no compile errors**

```bash
cd backend/GuitarDb.API
dotnet build
```

Expected: Build succeeded, 0 errors.

**Step 3: Commit**

```bash
git add backend/GuitarDb.API/Controllers/AdminController.cs
git commit -m "feat(orders): extend status endpoint to accept cancelled and fire cancellation email"
```

---

### Task 3: Update admin UI — status display and badge

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Update `getStatusDisplay` (around line 282)**

Add the `cancelled` case:

```typescript
const getStatusDisplay = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'paid':
      return 'Payment Received';
    case 'shipped':
      return 'Shipped';
    case 'delivered':
      return 'Delivered';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
};
```

**Step 2: Update the status badge (around line 1656)**

Replace the badge className logic to add red for cancelled:

```tsx
<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
  order.status === 'cancelled'
    ? 'bg-red-100 text-red-700'
    : order.status === 'pending'
    ? 'bg-yellow-100 text-yellow-700'
    : 'bg-green-100 text-green-700'
}`}>
  {getStatusDisplay(order.status)}
</span>
```

**Step 3: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat(admin): add cancelled status display and red badge"
```

---

### Task 4: Add Cancel / Restore Order buttons to admin UI

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Add `cancellingOrderId` state near other order state**

Find the block of `useState` declarations for orders (look for `editingTrackingId`, `savingTracking`, etc.) and add:

```typescript
const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
```

**Step 2: Add `cancelOrder` and `restoreOrder` handlers**

Add these two functions near `saveTracking`:

```typescript
const cancelOrder = async (orderId: string) => {
  setCancellingOrderId(orderId);
  try {
    await api.authPatch(`/admin/orders/${orderId}/status`, { status: 'cancelled' });
    await fetchOrders();
  } catch (err) {
    console.error('Failed to cancel order:', err);
  } finally {
    setCancellingOrderId(null);
  }
};

const restoreOrder = async (orderId: string) => {
  setCancellingOrderId(orderId);
  try {
    await api.authPatch(`/admin/orders/${orderId}/status`, { status: 'completed' });
    await fetchOrders();
  } catch (err) {
    console.error('Failed to restore order:', err);
  } finally {
    setCancellingOrderId(null);
  }
};
```

**Step 3: Add a new Actions column header**

Find the `<thead>` row in the orders table (look for `<th>` elements for Order, Date, Buyer, Items, Total, Payment, Status, Tracking, Address) and append:

```tsx
<th className="py-3 px-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
```

**Step 4: Add Cancel / Restore button cell in each order row**

After the Address `<td>` (the one containing the `expandedOrderId` toggle, around line 1724), add a new `<td>`:

```tsx
<td className="py-3 px-2">
  {order.status === 'cancelled' ? (
    <button
      onClick={() => restoreOrder(order.id)}
      disabled={cancellingOrderId === order.id}
      className="text-xs text-green-700 hover:underline disabled:opacity-50"
    >
      {cancellingOrderId === order.id ? 'Restoring...' : 'Restore'}
    </button>
  ) : (
    <button
      onClick={() => cancelOrder(order.id)}
      disabled={cancellingOrderId === order.id}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {cancellingOrderId === order.id ? 'Cancelling...' : 'Cancel'}
    </button>
  )}
</td>
```

**Step 5: Verify `api.authPatch` exists**

Check `frontend/lib/api.ts` for an `authPatch` method. If it doesn't exist but `authPost` or a generic `patch` method does, use that pattern instead. The tracking save uses `api.authPatch` — confirm the exact method name before implementing.

**Step 6: Start the dev server and test**

```bash
cd frontend
npm run dev
```

- Go to admin panel → Orders tab
- Confirm a non-cancelled order shows a red "Cancel" link
- Click Cancel on a test order — confirm status badge turns red and says "Cancelled", and "Cancel" link changes to "Restore"
- Click Restore — confirm it flips back to green "Payment Received"
- Check that the cancellation email fires (check SMTP logs or email inbox if configured)

**Step 7: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat(admin): add Cancel and Restore Order buttons to orders table"
```

---

### Task 5: Push to main

```bash
git push origin master
```
