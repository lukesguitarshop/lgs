# Recharts Setup Guide

## Installation

Recharts has been successfully installed in this Next.js project:

```bash
npm install recharts
```

## Available Chart Components

Two custom chart components have been created for visualizing guitar price data:

### 1. PriceHistoryChart

**Location:** `components/charts/PriceHistoryChart.tsx`

**Purpose:** Displays price trends over time for different conditions using line charts.

**Features:**
- Shows average prices for each condition over time
- Supports filtering by specific condition
- Interactive tooltips showing exact prices
- Responsive design
- Color-coded lines for each condition

**Usage:**
```tsx
import PriceHistoryChart from '@/components/charts/PriceHistoryChart';

<PriceHistoryChart
  priceHistory={guitar.priceHistory}
  selectedCondition={2} // Optional: filter to specific condition
/>
```

**Props:**
- `priceHistory: PriceSnapshot[]` - Array of price snapshots
- `selectedCondition?: number` - Optional condition filter (0-6)

### 2. PriceRangeChart

**Location:** `components/charts/PriceRangeChart.tsx`

**Purpose:** Displays min/avg/max price ranges for each condition using bar charts.

**Features:**
- Shows price ranges (min, average, max) for the latest snapshot
- Grouped bar chart for easy comparison
- Interactive tooltips
- Responsive design

**Usage:**
```tsx
import PriceRangeChart from '@/components/charts/PriceRangeChart';

<PriceRangeChart priceHistory={guitar.priceHistory} />
```

**Props:**
- `priceHistory: PriceSnapshot[]` - Array of price snapshots (uses the latest one)

## Condition Names & Colors

**Conditions (0-6):**
- 0: Brand New - `#2563eb` (Blue)
- 1: Mint - `#7c3aed` (Purple)
- 2: Excellent - `#059669` (Green)
- 3: Very Good - `#d97706` (Orange)
- 4: Good - `#dc2626` (Red)
- 5: Fair - `#9333ea` (Purple)
- 6: Poor - `#6b7280` (Gray)

## Integration Example

The charts are already integrated into the guitar detail page (`/guitars/[id]`):

```tsx
{guitar.priceHistory && guitar.priceHistory.length > 0 && (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
    <PriceHistoryChart priceHistory={guitar.priceHistory} />
    <PriceRangeChart priceHistory={guitar.priceHistory} />
  </div>
)}
```

## Creating Custom Charts

### Basic Line Chart Example

```tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function MyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="value" stroke="#2563eb" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Basic Bar Chart Example

```tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export default function MyBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="value" fill="#2563eb" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

## Available Chart Types

Recharts provides many chart types:

1. **LineChart** - For trends over time
2. **BarChart** - For comparisons
3. **AreaChart** - For filled trends
4. **PieChart** - For proportions
5. **ScatterChart** - For correlations
6. **RadarChart** - For multi-dimensional data
7. **ComposedChart** - For combining multiple chart types

## Important Notes

### Client-Side Rendering

All chart components must be marked with `'use client'` directive since Recharts uses browser APIs:

```tsx
'use client';

import { LineChart } from 'recharts';
// ... rest of component
```

### Responsive Container

Always wrap charts in `ResponsiveContainer` for proper sizing:

```tsx
<ResponsiveContainer width="100%" height={400}>
  <LineChart data={data}>
    {/* chart content */}
  </LineChart>
</ResponsiveContainer>
```

### Data Format

Recharts expects data in array format:

```typescript
const data = [
  { name: 'Jan', price: 2400 },
  { name: 'Feb', price: 2210 },
  { name: 'Mar', price: 2290 },
];
```

## Customization

### Tooltip Formatting

```tsx
<Tooltip
  formatter={(value: any) => `$${value.toLocaleString()}`}
  labelFormatter={(label) => `Date: ${label}`}
/>
```

### Axis Formatting

```tsx
<YAxis
  tickFormatter={(value) => `$${value.toLocaleString()}`}
/>

<XAxis
  dataKey="date"
  angle={-45}
  textAnchor="end"
  height={80}
/>
```

### Custom Colors

```tsx
<Line
  type="monotone"
  dataKey="price"
  stroke="#2563eb"
  strokeWidth={2}
  dot={{ r: 4 }}
  activeDot={{ r: 6 }}
/>
```

## Performance Tips

1. **Limit Data Points:** For large datasets, consider sampling or pagination
2. **Memoization:** Use `useMemo` for data transformations
3. **Debounce:** Debounce real-time updates
4. **Lazy Loading:** Load charts only when visible

Example with memoization:

```tsx
const chartData = useMemo(() => {
  return priceHistory.map(snapshot => ({
    date: new Date(snapshot.date).toLocaleDateString(),
    price: snapshot.averagePrice
  }));
}, [priceHistory]);
```

## Documentation

For more information, visit:
- [Recharts Documentation](https://recharts.org/en-US/)
- [Recharts Examples](https://recharts.org/en-US/examples)
- [Recharts API Reference](https://recharts.org/en-US/api)

## Testing

To test the charts, visit:
- Any guitar detail page: `/guitars/[id]`
- The charts will display if the guitar has price history data

Example: http://localhost:3000/guitars/6960191ff145d570d6d9e1a2
