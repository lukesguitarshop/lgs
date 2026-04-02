# Monthly Expenses in Breakdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Subtract per-month expenses from monthly profit in the Monthly Breakdown tab, and fix the cumulative view so live months (April+) seed from the last snapshot cumulative rather than zero.

**Architecture:** Backend groups existing expenses by year/month and attaches an `expenses` field to each `MonthlyBreakdown` entry. Frontend subtracts that amount from profit for non-snapshot months. The cumulative view fix keeps `runningSum` in sync with snapshot values as they're iterated, so the first live month naturally inherits the correct baseline.

**Tech Stack:** C# / ASP.NET Core (backend), TypeScript / React / Next.js (frontend), Fly.io (backend deploy), Vercel auto-deploys frontend on push to master.

---

### Task 1: Backend — attach per-month expenses to `monthlyBreakdown`

**Files:**
- Modify: `backend/GuitarDb.API/Controllers/AdminController.cs` (lines 1634–1687)

**Step 1: Open the `GetFinanceSummary` action**

Find the method at line 1634. Right after the `monthlyData` LINQ query (line 1655) and before the `snapshots` fetch (line 1658), add expense grouping:

```csharp
// Group expenses by year/month
var allExpenses = await _mongoDbService.GetExtraExpensesAsync();
var expensesByMonth = allExpenses
    .GroupBy(e => new { e.Date.Year, e.Date.Month })
    .ToDictionary(g => (g.Key.Year, g.Key.Month), g => g.Sum(e => e.Cost));
```

**Step 2: Attach `expenses` to each monthly entry in the returned object**

Change the `monthlyBreakdown = monthlyData` line to project an `expenses` field:

```csharp
monthlyBreakdown = monthlyData.Select(m => new
{
    m.year,
    m.month,
    m.profit,
    m.revenue,
    m.count,
    expenses = expensesByMonth.TryGetValue((m.year, m.month), out var exp) ? exp : 0m
}),
```

**Step 3: Verify it builds**

```bash
cd backend/GuitarDb.API && dotnet build
```

Expected: Build succeeded, 0 errors.

---

### Task 2: Frontend type — add `expenses` to `MonthlyBreakdown`

**Files:**
- Modify: `frontend/lib/types/finance-summary.ts`

**Step 1: Add `expenses` field**

```typescript
export interface MonthlyBreakdown {
  year: number;
  month: number;
  profit: number;
  revenue: number;
  count: number;
  expenses: number;   // <-- add this line
}
```

---

### Task 3: Frontend — subtract expenses and fix cumulative seeding

**Files:**
- Modify: `frontend/components/admin/MonthlyBreakdownTab.tsx`

**Step 1: Subtract expenses in the `monthlyValues` useMemo (lines 89–98)**

The existing block that adds live (non-snapshot) months currently stores `entry.profit` raw. Change it to subtract `entry.expenses`:

Old:
```typescript
    for (const entry of summary.monthlyBreakdown) {
      const key = `${entry.year}-${entry.month}`;
      yearSet.add(entry.year);
      // Only use calculated data if no snapshot exists for this month
      if (!cumulative.has(key)) {
        monthly.set(key, entry.profit);
        // For cumulative in calculated months, we'd need to add to the last snapshot cumulative
        // For simplicity, just store the monthly profit
      }
    }
```

New:
```typescript
    for (const entry of summary.monthlyBreakdown) {
      const key = `${entry.year}-${entry.month}`;
      yearSet.add(entry.year);
      if (!cumulative.has(key)) {
        monthly.set(key, entry.profit - (entry.expenses ?? 0));
      }
    }
```

**Step 2: Fix cumulative seeding in the `cellValues` useMemo (lines 104–142)**

Replace the entire `if (viewMode === 'cumulative')` block with this corrected version. The key change is that `runningSum` is updated to the snapshot value whenever a snapshot month is processed, so the first non-snapshot month inherits the right baseline. The cross-year seed also reads from the already-computed `values` map of the previous year.

Old block (lines 106–137):
```typescript
      const values = new Map<string, number>();
      for (const year of years) {
        let runningSum = 0;
        // Get the cumulative at the end of the previous year from snapshots
        const prevYearIdx = years.indexOf(year) - 1;
        if (prevYearIdx >= 0) {
          const prevYear = years[prevYearIdx];
          // Find last month with data in prev year
          for (let m = 12; m >= 1; m--) {
            const prevKey = `${prevYear}-${m}`;
            if (cumulativeValues.has(prevKey)) {
              // Don't carry over - cumulative shown is per-year or all-time based on snapshot
              break;
            }
          }
        }

        for (let month = 1; month <= 12; month++) {
          const key = `${year}-${month}`;
          if (cumulativeValues.has(key)) {
            // Use snapshot cumulative directly
            values.set(key, cumulativeValues.get(key)!);
          } else if (monthlyValues.has(key)) {
            runningSum += monthlyValues.get(key)!;
            values.set(key, runningSum);
          }
        }
      }
      return values;
```

New block:
```typescript
      const values = new Map<string, number>();
      for (const year of years) {
        // Seed runningSum from the last computed value of the previous year
        // so live months continue from the last snapshot rather than restarting at 0
        let runningSum = 0;
        const prevYearIdx = years.indexOf(year) - 1;
        if (prevYearIdx >= 0) {
          const prevYear = years[prevYearIdx];
          for (let m = 12; m >= 1; m--) {
            const prevKey = `${prevYear}-${m}`;
            if (values.has(prevKey)) {
              runningSum = values.get(prevKey)!;
              break;
            }
          }
        }

        for (let month = 1; month <= 12; month++) {
          const key = `${year}-${month}`;
          if (cumulativeValues.has(key)) {
            // Use snapshot value directly and keep runningSum in sync
            // so the first non-snapshot month continues from here
            runningSum = cumulativeValues.get(key)!;
            values.set(key, runningSum);
          } else if (monthlyValues.has(key)) {
            runningSum += monthlyValues.get(key)!;
            values.set(key, runningSum);
          }
        }
      }
      return values;
```

**Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

---

### Task 4: Commit and deploy

**Step 1: Commit all changes**

```bash
git add backend/GuitarDb.API/Controllers/AdminController.cs \
        frontend/lib/types/finance-summary.ts \
        frontend/components/admin/MonthlyBreakdownTab.tsx
git commit -m "feat: subtract monthly expenses from breakdown and fix cumulative seeding"
```

**Step 2: Push to master (auto-deploys frontend via Vercel)**

```bash
git push origin master
```

**Step 3: Deploy backend to Fly.io**

```bash
cd backend/GuitarDb.API && fly deploy
```

Expected: `v[N] deployed successfully`. Watch for any startup errors with `fly logs`.

**Step 4: Verify in production**

- Open https://lukesguitarshop.com/admin → Finances → Monthly Breakdown
- **Monthly view**: April should show transaction profit minus April expenses
- **Cumulative view**: April should show ~$50,000 + April net, not just ~$500
