# PriceChart Component

A reusable, interactive price history chart component built with Recharts.

## Features

- **Interactive Time Ranges**: Toggle between 30 days, 90 days, 1 year, and all-time views
- **Color-Coded Conditions**: Each guitar condition has a distinct color from the brand palette
- **Hover Tooltips**: Shows exact prices on hover with formatted currency
- **Auto-Detection**: Automatically detects which conditions have data and displays them
- **Condition Filtering**: Optionally filter to show only specific conditions
- **Price Statistics**: Displays min/max/avg prices for each condition in the selected time range
- **Responsive Design**: Works on mobile, tablet, and desktop screens
- **Configurable**: Custom titles, descriptions, and default ranges

## Installation

The component is already included in the project at `components/PriceChart.tsx`.

## Dependencies

- Recharts (for charting)
- shadcn/ui components (Card, Button)
- Type definitions from `@/types/guitar`

## Usage

### Basic Usage

```tsx
import PriceChart from '@/components/PriceChart';

<PriceChart priceHistory={guitar.priceHistory} />
```

### With Custom Configuration

```tsx
import PriceChart from '@/components/PriceChart';
import { GuitarCondition } from '@/types/guitar';

<PriceChart
  priceHistory={guitar.priceHistory}
  title="Price Trends"
  description="Historical pricing data with interactive time range selection"
  defaultRange={90}
  showConditions={[
    GuitarCondition.Mint,
    GuitarCondition.Excellent,
    GuitarCondition.VeryGood
  ]}
/>
```

## Props

| Prop | Type | Default | Required | Description |
|------|------|---------|----------|-------------|
| `priceHistory` | `PriceSnapshot[]` | - | Yes | Array of price snapshots containing historical pricing data |
| `title` | `string` | `"Price History"` | No | Title displayed at the top of the chart card |
| `description` | `string` | `"Track price trends..."` | No | Description text below the title |
| `defaultRange` | `30 \| 90 \| 365 \| 'all'` | `90` | No | Initial time range to display when component mounts |
| `showConditions` | `GuitarCondition[]` | auto-detect | No | Array of specific conditions to display. If omitted, shows all conditions with data |

## Examples

### Example 1: Default 90-Day View
```tsx
<PriceChart priceHistory={guitar.priceHistory} />
```
Shows all conditions with data, defaulting to a 90-day view.

### Example 2: 30-Day Recent Trends
```tsx
<PriceChart
  priceHistory={guitar.priceHistory}
  defaultRange={30}
  title="Recent Price Movements"
  description="Last 30 days of pricing data"
/>
```
Focuses on short-term price movements over the last month.

### Example 3: All-Time History
```tsx
<PriceChart
  priceHistory={guitar.priceHistory}
  defaultRange="all"
  title="Complete Price History"
  description="Full historical view of all price data"
/>
```
Displays the complete historical dataset.

### Example 4: Premium Conditions Only
```tsx
<PriceChart
  priceHistory={guitar.priceHistory}
  showConditions={[
    GuitarCondition.BrandNew,
    GuitarCondition.Mint,
    GuitarCondition.Excellent
  ]}
  title="Premium Condition Pricing"
  description="Track prices for brand new, mint, and excellent conditions"
/>
```
Filters to show only premium condition tiers.

### Example 5: Single Condition Analysis
```tsx
<PriceChart
  priceHistory={guitar.priceHistory}
  showConditions={[GuitarCondition.Excellent]}
  title="Excellent Condition Tracker"
  description="Isolated view of excellent condition pricing"
/>
```
Focuses on a single condition for detailed analysis.

## Color Palette

The component uses the following colors from `ConditionColors`:

- **Brand New**: Blue (#2563eb)
- **Mint**: Purple (#7c3aed)
- **Excellent**: Green (#059669)
- **Very Good**: Orange (#d97706)
- **Good**: Red (#dc2626)
- **Fair**: Purple (#9333ea)
- **Poor**: Gray (#6b7280)

## Data Requirements

The `priceHistory` prop should be an array of `PriceSnapshot` objects with the following structure:

```typescript
interface PriceSnapshot {
  date: string;  // ISO date string
  conditionPricing: ConditionPricing[];
  totalListingsScraped: number;
  scrapedAt: string;
}

interface ConditionPricing {
  condition: GuitarCondition;  // 0-6 enum value
  averagePrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  listingCount: number;
  currency: string;
}
```

## Edge Cases

- **No Data**: Shows a helpful empty state message
- **No Conditions with Data**: Displays appropriate message
- **Filtered Time Range with No Data**: Prompts user to select different range
- **Null Prices**: Lines connect through null values using `connectNulls` prop

## Responsive Behavior

- **Mobile (< 768px)**: Single column layout, stacked buttons, compact chart
- **Tablet (768px - 1024px)**: 2-column statistics grid
- **Desktop (> 1024px)**: Full-width chart with expanded statistics grid

## Integration

The component is currently used in:

1. **Guitar Detail Page** (`app/guitars/[id]/page.tsx`) - Shows full price history for individual guitars
2. **Charts Showcase** (`app/charts/page.tsx`) - Demonstrates various configurations

## Testing

Visit `/charts` to see the component in action with multiple examples and configurations.

## Performance

- Time range filtering is memoized for optimal performance
- Chart data transformation is memoized to avoid unnecessary recalculations
- Responsive container adapts to parent width automatically

## Accessibility

- Semantic HTML structure using Card components
- Keyboard-accessible toggle buttons
- Clear color contrast for readability
- Screen reader compatible

## Future Enhancements

Potential improvements:
- Export chart as PNG/SVG
- Compare multiple guitars side-by-side
- Zoom and pan controls
- Custom date range picker
- Annotation support for market events
- Price alert indicators
