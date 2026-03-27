# Admin Finance Dashboard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a finance tracking dashboard to the admin portal with transaction management, auto-calculated totals, monthly breakdowns, and expense tracking — replacing the existing Google Sheets workflow.

**Architecture:** Two new MongoDB collections (transactions, extra_expenses) with CRUD endpoints on the existing AdminController. Frontend adds two-tier tab navigation to the admin page: top-level "Operations | Finances" tabs, with Finances containing sub-tabs for Transactions, Dashboard, Monthly Breakdown, and Extra Expenses. recharts (already installed) used for charts on the Dashboard tab.

**Tech Stack:** .NET 9 + MongoDB (backend), Next.js 15 + TypeScript + shadcn/ui + Tailwind + recharts (frontend)

---

## Task 1: Backend — Transaction & ExtraExpense Models

**Files:**
- Create: `backend/GuitarDb.API/Models/Transaction.cs`
- Create: `backend/GuitarDb.API/Models/ExtraExpense.cs`

**Step 1: Create Transaction model**

Create `backend/GuitarDb.API/Models/Transaction.cs`:

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class Transaction
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("date")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime Date { get; set; }

    [BsonElement("guitar_name")]
    public string GuitarName { get; set; } = string.Empty;

    [BsonElement("purchase_price")]
    [BsonIgnoreIfNull]
    public decimal? PurchasePrice { get; set; }

    [BsonElement("transaction_type")]
    public string TransactionType { get; set; } = string.Empty; // "sold" or "traded"

    [BsonElement("sold_via")]
    [BsonIgnoreIfNull]
    public string? SoldVia { get; set; } // "Reverb", "Cash", "PayPal", "eBay", "Venmo"

    [BsonElement("trade_for")]
    [BsonIgnoreIfNull]
    public string? TradeFor { get; set; }

    [BsonElement("revenue")]
    [BsonIgnoreIfNull]
    public decimal? Revenue { get; set; }

    [BsonElement("shipping_cost")]
    [BsonIgnoreIfNull]
    public decimal? ShippingCost { get; set; }

    [BsonElement("profit")]
    [BsonIgnoreIfNull]
    public decimal? Profit { get; set; }

    [BsonElement("tracking_carrier")]
    [BsonIgnoreIfNull]
    public string? TrackingCarrier { get; set; }

    [BsonElement("tracking_number")]
    [BsonIgnoreIfNull]
    public string? TrackingNumber { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [BsonElement("updated_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
```

**Step 2: Create ExtraExpense model**

Create `backend/GuitarDb.API/Models/ExtraExpense.cs`:

```csharp
using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace GuitarDb.API.Models;

public class ExtraExpense
{
    [BsonId]
    [BsonRepresentation(BsonType.ObjectId)]
    public string? Id { get; set; }

    [BsonElement("date")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime Date { get; set; }

    [BsonElement("category")]
    public string Category { get; set; } = string.Empty;

    [BsonElement("cost")]
    public decimal Cost { get; set; }

    [BsonElement("created_at")]
    [BsonDateTimeOptions(Kind = DateTimeKind.Utc)]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
```

**Step 3: Verify build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 4: Commit**

```bash
git add backend/GuitarDb.API/Models/Transaction.cs backend/GuitarDb.API/Models/ExtraExpense.cs
git commit -m "feat: add Transaction and ExtraExpense MongoDB models"
```

---

## Task 2: Backend — MongoDbService Collection Registration

**Files:**
- Modify: `backend/GuitarDb.API/Services/MongoDbService.cs`

**Step 1: Add collection fields**

Add these private fields alongside the existing collection declarations (near the top of MongoDbService class):

```csharp
private readonly IMongoCollection<Transaction> _transactionsCollection;
private readonly IMongoCollection<ExtraExpense> _extraExpensesCollection;
```

**Step 2: Initialize collections in constructor**

In the constructor, after the existing collection initializations, add:

```csharp
_transactionsCollection = database.GetCollection<Transaction>("transactions");
_extraExpensesCollection = database.GetCollection<ExtraExpense>("extra_expenses");
```

**Step 3: Add indexes in constructor**

After existing index creation blocks, add:

```csharp
// Transaction indexes
_transactionsCollection.Indexes.CreateMany(new[]
{
    new CreateIndexModel<Transaction>(
        Builders<Transaction>.IndexKeys.Descending(t => t.Date),
        new CreateIndexOptions { Name = "date_desc" }),
    new CreateIndexModel<Transaction>(
        Builders<Transaction>.IndexKeys.Descending(t => t.CreatedAt),
        new CreateIndexOptions { Name = "created_at_desc" })
});

// ExtraExpense indexes
_extraExpensesCollection.Indexes.CreateMany(new[]
{
    new CreateIndexModel<ExtraExpense>(
        Builders<ExtraExpense>.IndexKeys.Descending(e => e.Date),
        new CreateIndexOptions { Name = "date_desc" })
});
```

**Step 4: Add Transaction CRUD methods**

Add these methods to MongoDbService:

```csharp
// === Transactions ===

public async Task<List<Transaction>> GetTransactionsAsync(int? year = null, int? month = null)
{
    var filter = Builders<Transaction>.Filter.Empty;
    if (year.HasValue)
    {
        var start = new DateTime(year.Value, month ?? 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = month.HasValue
            ? start.AddMonths(1)
            : start.AddYears(1);
        filter = Builders<Transaction>.Filter.And(
            Builders<Transaction>.Filter.Gte(t => t.Date, start),
            Builders<Transaction>.Filter.Lt(t => t.Date, end));
    }
    return await _transactionsCollection
        .Find(filter)
        .SortByDescending(t => t.Date)
        .ToListAsync();
}

public async Task<Transaction?> GetTransactionByIdAsync(string id) =>
    await _transactionsCollection.Find(t => t.Id == id).FirstOrDefaultAsync();

public async Task CreateTransactionAsync(Transaction transaction) =>
    await _transactionsCollection.InsertOneAsync(transaction);

public async Task CreateTransactionsManyAsync(List<Transaction> transactions) =>
    await _transactionsCollection.InsertManyAsync(transactions);

public async Task UpdateTransactionAsync(string id, Transaction transaction)
{
    transaction.UpdatedAt = DateTime.UtcNow;
    await _transactionsCollection.ReplaceOneAsync(t => t.Id == id, transaction);
}

public async Task DeleteTransactionAsync(string id) =>
    await _transactionsCollection.DeleteOneAsync(t => t.Id == id);

public async Task<(decimal totalRevenue, decimal totalExpenses, decimal totalProfit, List<PlatformStat> platformStats)> GetFinanceSummaryAsync()
{
    var transactions = await _transactionsCollection.Find(_ => true).ToListAsync();
    var expenses = await _extraExpensesCollection.Find(_ => true).ToListAsync();

    var totalRevenue = transactions.Where(t => t.Revenue.HasValue).Sum(t => t.Revenue!.Value);
    var totalExpenses = expenses.Sum(e => e.Cost);
    var totalProfit = transactions.Where(t => t.Profit.HasValue).Sum(t => t.Profit!.Value);

    var platformStats = transactions
        .Where(t => t.TransactionType == "sold" && t.SoldVia != null)
        .GroupBy(t => t.SoldVia!)
        .Select(g => new PlatformStat
        {
            Platform = g.Key,
            Count = g.Count(),
            TotalProfit = g.Where(t => t.Profit.HasValue).Sum(t => t.Profit!.Value),
            TotalRevenue = g.Where(t => t.Revenue.HasValue).Sum(t => t.Revenue!.Value)
        })
        .OrderByDescending(p => p.TotalProfit)
        .ToList();

    return (totalRevenue, totalExpenses, totalProfit, platformStats);
}

// === Extra Expenses ===

public async Task<List<ExtraExpense>> GetExtraExpensesAsync() =>
    await _extraExpensesCollection
        .Find(_ => true)
        .SortByDescending(e => e.Date)
        .ToListAsync();

public async Task<ExtraExpense?> GetExtraExpenseByIdAsync(string id) =>
    await _extraExpensesCollection.Find(e => e.Id == id).FirstOrDefaultAsync();

public async Task CreateExtraExpenseAsync(ExtraExpense expense) =>
    await _extraExpensesCollection.InsertOneAsync(expense);

public async Task UpdateExtraExpenseAsync(string id, ExtraExpense expense) =>
    await _extraExpensesCollection.ReplaceOneAsync(e => e.Id == id, expense);

public async Task DeleteExtraExpenseAsync(string id) =>
    await _extraExpensesCollection.DeleteOneAsync(e => e.Id == id);
```

**Step 5: Add PlatformStat class**

Add this class at the bottom of MongoDbService.cs (or in a separate file if preferred — but keeping inline matches existing patterns in the codebase):

```csharp
public class PlatformStat
{
    public string Platform { get; set; } = string.Empty;
    public int Count { get; set; }
    public decimal TotalProfit { get; set; }
    public decimal TotalRevenue { get; set; }
}
```

**Step 6: Verify build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 7: Commit**

```bash
git add backend/GuitarDb.API/Services/MongoDbService.cs
git commit -m "feat: add Transaction and ExtraExpense MongoDB collections with CRUD methods"
```

---

## Task 3: Backend — Admin API Endpoints

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs`

**Step 1: Add Transaction endpoints**

Add these endpoints to AdminController (follow existing patterns — all methods are inside the `[AdminAuthorize]` controller):

```csharp
// === Transactions ===

[HttpGet("transactions")]
public async Task<IActionResult> GetTransactions([FromQuery] int? year, [FromQuery] int? month)
{
    try
    {
        var transactions = await _mongoDbService.GetTransactionsAsync(year, month);
        return Ok(transactions.Select(t => new
        {
            id = t.Id,
            date = t.Date,
            guitarName = t.GuitarName,
            purchasePrice = t.PurchasePrice,
            transactionType = t.TransactionType,
            soldVia = t.SoldVia,
            tradeFor = t.TradeFor,
            revenue = t.Revenue,
            shippingCost = t.ShippingCost,
            profit = t.Profit,
            trackingCarrier = t.TrackingCarrier,
            trackingNumber = t.TrackingNumber,
            createdAt = t.CreatedAt,
            updatedAt = t.UpdatedAt
        }));
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to fetch transactions");
        return StatusCode(500, new { error = "Failed to fetch transactions" });
    }
}

[HttpPost("transactions")]
public async Task<IActionResult> CreateTransaction([FromBody] CreateTransactionRequest request)
{
    try
    {
        var transaction = new Transaction
        {
            Date = request.Date.ToUniversalTime(),
            GuitarName = request.GuitarName,
            PurchasePrice = request.PurchasePrice,
            TransactionType = request.TransactionType,
            SoldVia = request.SoldVia,
            TradeFor = request.TradeFor,
            Revenue = request.Revenue,
            ShippingCost = request.ShippingCost,
            Profit = request.Profit,
            TrackingCarrier = request.TrackingCarrier,
            TrackingNumber = request.TrackingNumber,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };
        await _mongoDbService.CreateTransactionAsync(transaction);
        return Ok(new { id = transaction.Id, message = "Transaction created" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to create transaction");
        return StatusCode(500, new { error = "Failed to create transaction" });
    }
}

[HttpPut("transactions/{id}")]
public async Task<IActionResult> UpdateTransaction(string id, [FromBody] CreateTransactionRequest request)
{
    try
    {
        var existing = await _mongoDbService.GetTransactionByIdAsync(id);
        if (existing == null) return NotFound(new { error = "Transaction not found" });

        existing.Date = request.Date.ToUniversalTime();
        existing.GuitarName = request.GuitarName;
        existing.PurchasePrice = request.PurchasePrice;
        existing.TransactionType = request.TransactionType;
        existing.SoldVia = request.SoldVia;
        existing.TradeFor = request.TradeFor;
        existing.Revenue = request.Revenue;
        existing.ShippingCost = request.ShippingCost;
        existing.Profit = request.Profit;
        existing.TrackingCarrier = request.TrackingCarrier;
        existing.TrackingNumber = request.TrackingNumber;

        await _mongoDbService.UpdateTransactionAsync(id, existing);
        return Ok(new { message = "Transaction updated" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to update transaction");
        return StatusCode(500, new { error = "Failed to update transaction" });
    }
}

[HttpDelete("transactions/{id}")]
public async Task<IActionResult> DeleteTransaction(string id)
{
    try
    {
        var existing = await _mongoDbService.GetTransactionByIdAsync(id);
        if (existing == null) return NotFound(new { error = "Transaction not found" });

        await _mongoDbService.DeleteTransactionAsync(id);
        return Ok(new { message = "Transaction deleted" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to delete transaction");
        return StatusCode(500, new { error = "Failed to delete transaction" });
    }
}

[HttpPost("transactions/import")]
public async Task<IActionResult> ImportTransactions([FromBody] List<CreateTransactionRequest> requests)
{
    try
    {
        var transactions = requests.Select(r => new Transaction
        {
            Date = r.Date.ToUniversalTime(),
            GuitarName = r.GuitarName,
            PurchasePrice = r.PurchasePrice,
            TransactionType = r.TransactionType,
            SoldVia = r.SoldVia,
            TradeFor = r.TradeFor,
            Revenue = r.Revenue,
            ShippingCost = r.ShippingCost,
            Profit = r.Profit,
            TrackingCarrier = r.TrackingCarrier,
            TrackingNumber = r.TrackingNumber,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        }).ToList();

        await _mongoDbService.CreateTransactionsManyAsync(transactions);
        return Ok(new { message = $"Imported {transactions.Count} transactions" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to import transactions");
        return StatusCode(500, new { error = "Failed to import transactions" });
    }
}
```

**Step 2: Add ExtraExpense endpoints**

```csharp
// === Extra Expenses ===

[HttpGet("extra-expenses")]
public async Task<IActionResult> GetExtraExpenses()
{
    try
    {
        var expenses = await _mongoDbService.GetExtraExpensesAsync();
        return Ok(expenses.Select(e => new
        {
            id = e.Id,
            date = e.Date,
            category = e.Category,
            cost = e.Cost,
            createdAt = e.CreatedAt
        }));
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to fetch extra expenses");
        return StatusCode(500, new { error = "Failed to fetch extra expenses" });
    }
}

[HttpPost("extra-expenses")]
public async Task<IActionResult> CreateExtraExpense([FromBody] CreateExtraExpenseRequest request)
{
    try
    {
        var expense = new ExtraExpense
        {
            Date = request.Date.ToUniversalTime(),
            Category = request.Category,
            Cost = request.Cost,
            CreatedAt = DateTime.UtcNow
        };
        await _mongoDbService.CreateExtraExpenseAsync(expense);
        return Ok(new { id = expense.Id, message = "Expense created" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to create extra expense");
        return StatusCode(500, new { error = "Failed to create extra expense" });
    }
}

[HttpPut("extra-expenses/{id}")]
public async Task<IActionResult> UpdateExtraExpense(string id, [FromBody] CreateExtraExpenseRequest request)
{
    try
    {
        var existing = await _mongoDbService.GetExtraExpenseByIdAsync(id);
        if (existing == null) return NotFound(new { error = "Expense not found" });

        existing.Date = request.Date.ToUniversalTime();
        existing.Category = request.Category;
        existing.Cost = request.Cost;

        await _mongoDbService.UpdateExtraExpenseAsync(id, existing);
        return Ok(new { message = "Expense updated" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to update extra expense");
        return StatusCode(500, new { error = "Failed to update extra expense" });
    }
}

[HttpDelete("extra-expenses/{id}")]
public async Task<IActionResult> DeleteExtraExpense(string id)
{
    try
    {
        var existing = await _mongoDbService.GetExtraExpenseByIdAsync(id);
        if (existing == null) return NotFound(new { error = "Expense not found" });

        await _mongoDbService.DeleteExtraExpenseAsync(id);
        return Ok(new { message = "Expense deleted" });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to delete extra expense");
        return StatusCode(500, new { error = "Failed to delete extra expense" });
    }
}
```

**Step 3: Add Finance Summary endpoint**

```csharp
[HttpGet("finance-summary")]
public async Task<IActionResult> GetFinanceSummary()
{
    try
    {
        var (totalRevenue, totalExpenses, totalProfit, platformStats) =
            await _mongoDbService.GetFinanceSummaryAsync();

        // Monthly breakdown
        var transactions = await _mongoDbService.GetTransactionsAsync();
        var monthlyData = transactions
            .Where(t => t.Profit.HasValue)
            .GroupBy(t => new { t.Date.Year, t.Date.Month })
            .Select(g => new
            {
                year = g.Key.Year,
                month = g.Key.Month,
                profit = g.Sum(t => t.Profit!.Value),
                revenue = g.Where(t => t.Revenue.HasValue).Sum(t => t.Revenue!.Value),
                count = g.Count()
            })
            .OrderBy(m => m.year).ThenBy(m => m.month)
            .ToList();

        return Ok(new
        {
            totalRevenue,
            totalExpenses,
            totalProfit = totalProfit - totalExpenses,
            grossProfit = totalProfit,
            platformStats = platformStats.Select(p => new
            {
                platform = p.Platform,
                count = p.Count,
                totalProfit = p.TotalProfit,
                totalRevenue = p.TotalRevenue
            }),
            monthlyBreakdown = monthlyData
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Failed to get finance summary");
        return StatusCode(500, new { error = "Failed to get finance summary" });
    }
}
```

**Step 4: Add request DTOs**

Add these classes at the bottom of AdminController.cs (inline with existing patterns):

```csharp
public class CreateTransactionRequest
{
    public DateTime Date { get; set; }
    public string GuitarName { get; set; } = string.Empty;
    public decimal? PurchasePrice { get; set; }
    public string TransactionType { get; set; } = string.Empty;
    public string? SoldVia { get; set; }
    public string? TradeFor { get; set; }
    public decimal? Revenue { get; set; }
    public decimal? ShippingCost { get; set; }
    public decimal? Profit { get; set; }
    public string? TrackingCarrier { get; set; }
    public string? TrackingNumber { get; set; }
}

public class CreateExtraExpenseRequest
{
    public DateTime Date { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal Cost { get; set; }
}
```

**Step 5: Verify build**

Run: `cd backend/GuitarDb.API && dotnet build`
Expected: Build succeeded

**Step 6: Commit**

```bash
git add backend/GuitarDb.API/Controllers/AdminController.cs
git commit -m "feat: add admin API endpoints for transactions, extra expenses, and finance summary"
```

---

## Task 4: Frontend — TypeScript Types

**Files:**
- Create: `frontend/lib/types/transaction.ts`
- Create: `frontend/lib/types/extra-expense.ts`
- Create: `frontend/lib/types/finance-summary.ts`

**Step 1: Create Transaction types**

Create `frontend/lib/types/transaction.ts`:

```typescript
export interface Transaction {
  id: string;
  date: string;
  guitarName: string;
  purchasePrice: number | null;
  transactionType: 'sold' | 'traded';
  soldVia: string | null;
  tradeFor: string | null;
  revenue: number | null;
  shippingCost: number | null;
  profit: number | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  date: string;
  guitarName: string;
  purchasePrice: number | null;
  transactionType: 'sold' | 'traded';
  soldVia: string | null;
  tradeFor: string | null;
  revenue: number | null;
  shippingCost: number | null;
  profit: number | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
}
```

**Step 2: Create ExtraExpense types**

Create `frontend/lib/types/extra-expense.ts`:

```typescript
export interface ExtraExpense {
  id: string;
  date: string;
  category: string;
  cost: number;
  createdAt: string;
}

export interface CreateExtraExpenseRequest {
  date: string;
  category: string;
  cost: number;
}
```

**Step 3: Create FinanceSummary types**

Create `frontend/lib/types/finance-summary.ts`:

```typescript
export interface PlatformStat {
  platform: string;
  count: number;
  totalProfit: number;
  totalRevenue: number;
}

export interface MonthlyBreakdown {
  year: number;
  month: number;
  profit: number;
  revenue: number;
  count: number;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  grossProfit: number;
  platformStats: PlatformStat[];
  monthlyBreakdown: MonthlyBreakdown[];
}
```

**Step 4: Commit**

```bash
git add frontend/lib/types/transaction.ts frontend/lib/types/extra-expense.ts frontend/lib/types/finance-summary.ts
git commit -m "feat: add TypeScript types for transactions, extra expenses, and finance summary"
```

---

## Task 5: Frontend — Two-Tier Admin Navigation

**Files:**
- Modify: `frontend/app/admin/page.tsx`

This is the most complex frontend task. The admin page is 1,533 lines. We need to:
1. Add a top-level tab layer (Operations | Finances)
2. Wrap existing content under Operations
3. Add Finances tab with placeholder content

**Step 1: Add top-level tab state**

Near the existing `activeTab` state (around line 127), add:

```typescript
const [adminSection, setAdminSection] = useState<'operations' | 'finances'>('operations');
```

And add a localStorage persistence effect (similar to existing `activeTab` pattern):

```typescript
useEffect(() => {
  const savedSection = localStorage.getItem('adminSection');
  if (savedSection && ['operations', 'finances'].includes(savedSection)) {
    setAdminSection(savedSection as 'operations' | 'finances');
  }
}, []);

const handleSectionChange = (value: string) => {
  setAdminSection(value as 'operations' | 'finances');
  localStorage.setItem('adminSection', value);
};
```

**Step 2: Wrap existing tabs in top-level navigation**

Find the main `<Tabs value={activeTab}...>` block (around line 562). Wrap everything from that `<Tabs>` through its closing `</Tabs>` with:

```tsx
{/* Top-level section tabs */}
<Tabs value={adminSection} onValueChange={handleSectionChange} className="w-full mb-6">
  <TabsList className="grid w-full grid-cols-2 mb-4">
    <TabsTrigger value="operations" className="flex items-center gap-2 text-base">
      <Settings className="h-4 w-4" />
      <span>Operations</span>
    </TabsTrigger>
    <TabsTrigger value="finances" className="flex items-center gap-2 text-base">
      <DollarSign className="h-4 w-4" />
      <span>Finances</span>
    </TabsTrigger>
  </TabsList>

  <TabsContent value="operations">
    {/* === Existing inner tabs go here (the entire <Tabs value={activeTab}...> block) === */}
  </TabsContent>

  <TabsContent value="finances">
    <FinancesSection />
  </TabsContent>
</Tabs>
```

Add the new icon imports at the top of the file (with existing lucide-react imports):

```typescript
import { Settings, DollarSign } from 'lucide-react';
```

**Step 3: Create FinancesSection placeholder**

For now, add a simple placeholder component at the bottom of the file (before the default export) or inline. We'll extract it into separate components in subsequent tasks:

```tsx
function FinancesSection() {
  return (
    <div className="text-center py-12 text-[#020E1C]/60">
      <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-40" />
      <p className="text-lg">Finance dashboard coming soon...</p>
    </div>
  );
}
```

**Step 4: Verify the page renders with the two-tier tabs**

Run the frontend dev server and confirm:
- Top-level tabs (Operations | Finances) appear
- Operations tab shows all existing admin content unchanged
- Finances tab shows the placeholder
- Tab state persists in localStorage

**Step 5: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: add two-tier navigation (Operations | Finances) to admin portal"
```

---

## Task 6: Frontend — Transactions Tab Component

**Files:**
- Create: `frontend/components/admin/TransactionsTab.tsx`

**Step 1: Create the TransactionsTab component**

Create `frontend/components/admin/TransactionsTab.tsx` — a full CRUD table for transactions with:
- Table displaying all transactions sorted by date descending
- "Add Transaction" button opening a dialog form
- Click row to edit (opens same dialog in edit mode)
- Delete with confirmation
- Color-coded profit column (green/red)
- Tracking info display
- CSV import button

Key implementation details:
- Use existing shadcn components: `Table`, `Dialog`, `Button`, `Input`, `Select`, `Label`
- Use `api.authGet/authPost/authPut/authDelete` for API calls
- Use `useToast` for success/error notifications
- Follow the same patterns as existing admin components (DealFinderTab, UsersTab)

The component should:
1. Fetch transactions on mount via `api.authGet<Transaction[]>('/admin/transactions')`
2. Display in a table with columns: Date, Guitar, Purchase Price, Type, Platform, Trade For, Revenue, Shipping, Profit, Tracking
3. Format currency values as `$X,XXX.XX`
4. Color profit green when positive, red when negative
5. "Add Transaction" opens a Dialog with form fields for all Transaction properties
6. Transaction type toggle (Sold/Traded) shows/hides relevant fields:
   - Sold: shows Platform, Revenue, Shipping, Profit (auto-calc)
   - Traded: shows Trade For
7. Profit auto-calculates: revenue - purchasePrice - shippingCost
8. Edit mode: clicking a row populates the dialog with existing data
9. Delete: confirmation dialog before deleting
10. CSV Import: file input that parses CSV, shows preview, and posts to `/admin/transactions/import`

The CSV parser should handle the format from the Google Sheet:
- Columns: Guitar, Purchase Price, Sold/Traded, Transaction Type, Trade For, Revenue, Shipping Cost, Profit
- Currency values like `"$1,350.00"` need parsing (strip $, commas)
- Empty values = null
- Date column doesn't exist in CSV, so during import set date to the import date (user can edit later)

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeded (though component isn't mounted yet)

**Step 3: Commit**

```bash
git add frontend/components/admin/TransactionsTab.tsx
git commit -m "feat: add TransactionsTab component with CRUD and CSV import"
```

---

## Task 7: Frontend — Dashboard Tab Component

**Files:**
- Create: `frontend/components/admin/DashboardTab.tsx`

**Step 1: Create the DashboardTab component**

Create `frontend/components/admin/DashboardTab.tsx`:

Key features:
1. Fetch finance summary on mount via `api.authGet<FinanceSummary>('/admin/finance-summary')`
2. **Summary cards** (top row): Total Revenue, Total Extra Expenses, Gross Profit (from transactions), Net Profit (gross - expenses) — large numbers with colored backgrounds
3. **Platform breakdown** using recharts `BarChart` — bar chart showing profit per platform (Reverb, Cash, PayPal, etc.)
4. **Win/loss stats** — count of profitable vs unprofitable transactions
5. **Trade chain visualization** — detect chains of trades from transaction data. A trade chain is: buy guitar A → trade for B → trade for C → sell C. Show these as linked cards.

Use recharts (already in package.json):
```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
```

Color scheme should match the site: maroon (#6E0114), navy (#020E1C), cream (#FFFFF3).

**Step 2: Commit**

```bash
git add frontend/components/admin/DashboardTab.tsx
git commit -m "feat: add DashboardTab with summary cards, charts, and trade chain visualization"
```

---

## Task 8: Frontend — Monthly Breakdown Tab Component

**Files:**
- Create: `frontend/components/admin/MonthlyBreakdownTab.tsx`

**Step 1: Create the MonthlyBreakdownTab component**

Create `frontend/components/admin/MonthlyBreakdownTab.tsx`:

Key features:
1. Uses the `monthlyBreakdown` data from the finance summary endpoint
2. Renders a grid/table with:
   - Rows: Jan through Dec
   - Columns: one per year that has data
   - Cell values: monthly profit
3. Toggle between two views:
   - **Monthly profit**: each cell shows only that month's profit
   - **Cumulative**: each cell shows running total up to that month within the year
4. Bottom rows: Yearly Total, This Month's Profit, Average per Month
5. Color-code cells: green for positive months, red for negative
6. Highlight current month

Use the existing `Table` shadcn component and `Button` for the toggle.

**Step 2: Commit**

```bash
git add frontend/components/admin/MonthlyBreakdownTab.tsx
git commit -m "feat: add MonthlyBreakdownTab with monthly/cumulative toggle"
```

---

## Task 9: Frontend — Extra Expenses Tab Component

**Files:**
- Create: `frontend/components/admin/ExtraExpensesTab.tsx`

**Step 1: Create the ExtraExpensesTab component**

Create `frontend/components/admin/ExtraExpensesTab.tsx`:

Key features:
1. Fetch expenses on mount via `api.authGet<ExtraExpense[]>('/admin/extra-expenses')`
2. Table with columns: Date, Category, Cost
3. "Add Expense" button opens Dialog with date picker, category select (predefined categories: Boxes, Packing Materials, Tool, Guitar Part, Printing Supplies, Carrier Adjustment, Other), and cost input
4. Click row to edit
5. Delete with confirmation
6. **Category subtotals** section at bottom — sum per category
7. **Grand total** at very bottom

Follow the same CRUD pattern as TransactionsTab.

**Step 2: Commit**

```bash
git add frontend/components/admin/ExtraExpensesTab.tsx
git commit -m "feat: add ExtraExpensesTab with CRUD and category subtotals"
```

---

## Task 10: Frontend — Wire Up FinancesSection

**Files:**
- Modify: `frontend/app/admin/page.tsx`

**Step 1: Replace placeholder FinancesSection with real content**

Replace the placeholder `FinancesSection` component with:

```tsx
function FinancesSection() {
  const [financeTab, setFinanceTab] = useState('transactions');

  useEffect(() => {
    const saved = localStorage.getItem('adminFinanceTab');
    if (saved && ['transactions', 'dashboard', 'monthly', 'expenses'].includes(saved)) {
      setFinanceTab(saved);
    }
  }, []);

  const handleFinanceTabChange = (value: string) => {
    setFinanceTab(value);
    localStorage.setItem('adminFinanceTab', value);
  };

  return (
    <Tabs value={financeTab} onValueChange={handleFinanceTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-4 mb-6">
        <TabsTrigger value="transactions" className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          <span className="hidden sm:inline">Transactions</span>
        </TabsTrigger>
        <TabsTrigger value="dashboard" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span className="hidden sm:inline">Dashboard</span>
        </TabsTrigger>
        <TabsTrigger value="monthly" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Monthly</span>
        </TabsTrigger>
        <TabsTrigger value="expenses" className="flex items-center gap-2">
          <Receipt className="h-4 w-4" />
          <span className="hidden sm:inline">Expenses</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="transactions">
        <TransactionsTab />
      </TabsContent>
      <TabsContent value="dashboard">
        <DashboardTab />
      </TabsContent>
      <TabsContent value="monthly">
        <MonthlyBreakdownTab />
      </TabsContent>
      <TabsContent value="expenses">
        <ExtraExpensesTab />
      </TabsContent>
    </Tabs>
  );
}
```

Add imports at the top of the file:

```typescript
import { ArrowLeftRight, BarChart3, Calendar } from 'lucide-react';
import TransactionsTab from '@/components/admin/TransactionsTab';
import DashboardTab from '@/components/admin/DashboardTab';
import MonthlyBreakdownTab from '@/components/admin/MonthlyBreakdownTab';
import ExtraExpensesTab from '@/components/admin/ExtraExpensesTab';
```

Note: `Receipt` icon is likely already imported for the Orders tab. `Calendar` and `ArrowLeftRight` and `BarChart3` need to be added to the lucide-react import.

**Step 2: Verify build and test locally**

Run: `cd frontend && npm run dev`

Test:
1. Navigate to admin portal
2. See Operations | Finances top tabs
3. Click Finances
4. See Transactions | Dashboard | Monthly | Expenses sub-tabs
5. Test CRUD on Transactions (add, edit, delete)
6. Test CSV import with the provided CSV data
7. Verify Dashboard shows summary cards and charts
8. Verify Monthly Breakdown shows the grid with toggle
9. Test CRUD on Extra Expenses
10. Verify all tab states persist in localStorage

**Step 3: Commit**

```bash
git add frontend/app/admin/page.tsx
git commit -m "feat: wire up FinancesSection with all sub-tabs in admin portal"
```

---

## Task 11: Local Integration Testing

**Step 1: Start backend**

Run: `cd backend/GuitarDb.API && dotnet run`
Expected: API starts on configured port

**Step 2: Start frontend**

Run: `cd frontend && npm run dev`
Expected: Next.js dev server starts

**Step 3: Test full flow**

1. Log in as admin
2. Navigate to admin portal → see two-tier tabs
3. **Operations tab**: verify all existing functionality still works (listings, messages, offers, orders, users)
4. **Finances → Transactions**:
   - Add a test transaction (sold via Reverb, with tracking)
   - Verify it appears in the table with correct formatting
   - Edit the transaction
   - Verify profit auto-calculates
   - Delete the transaction
5. **Finances → Transactions → CSV Import**:
   - Upload the existing CSV file
   - Verify preview shows correct data
   - Import and verify all rows appear
6. **Finances → Dashboard**:
   - Verify summary cards show correct totals
   - Verify platform breakdown chart renders
   - Verify trade chains are detected and displayed
7. **Finances → Monthly**:
   - Verify grid shows data by month/year
   - Toggle between monthly and cumulative views
   - Verify yearly totals and averages
8. **Finances → Expenses**:
   - Add a test expense
   - Verify category subtotals
   - Edit and delete

**Step 4: Fix any issues found during testing**

**Step 5: Final commit**

```bash
git add -A
git commit -m "fix: address issues found during local integration testing"
```
