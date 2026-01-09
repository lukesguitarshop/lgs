# TypeScript Types Documentation

## Overview

This project uses centralized TypeScript interfaces that match the C# models from the backend API. All types are defined in `types/guitar.ts` and exported for use throughout the application.

## Type Structure

### Core Interfaces

#### **Guitar**
The main guitar model matching the C# `Guitar` class.

```typescript
interface Guitar {
  id: string;
  brand: string;
  model: string;
  year: number | null;
  finish?: string | null;
  category?: string | null;
  specs?: GuitarSpecs | null;
  images?: string[] | null;
  priceHistory?: PriceSnapshot[] | null;
  createdAt: string;
  updatedAt: string;
}
```

**Fields:**
- `id`: MongoDB ObjectId as string
- `brand`: Guitar manufacturer (e.g., "Gibson", "Fender")
- `model`: Guitar model name
- `year`: Manufacturing year (nullable)
- `finish`: Color/finish description (optional)
- `category`: Guitar category (e.g., "Electric", "Acoustic")
- `specs`: Detailed specifications (optional)
- `images`: Array of image URLs (optional)
- `priceHistory`: Array of price snapshots
- `createdAt`: ISO 8601 date string
- `updatedAt`: ISO 8601 date string

#### **GuitarSpecs**
Complete guitar specifications.

```typescript
interface GuitarSpecs {
  body?: BodySpecs | null;
  neck?: NeckSpecs | null;
  electronics?: ElectronicsSpecs | null;
  hardware?: HardwareSpecs | null;
}
```

**Sub-Specifications:**

```typescript
interface BodySpecs {
  wood?: string | null;
  top?: string | null;
  binding?: string | null;
}

interface NeckSpecs {
  wood?: string | null;
  profile?: string | null;
  frets?: number | null;
  scaleLength?: number | null;
}

interface ElectronicsSpecs {
  pickups?: string[] | null;
  controls?: string[] | null;
}

interface HardwareSpecs {
  bridge?: string | null;
  tailpiece?: string | null;
  tuners?: string | null;
}
```

#### **PriceSnapshot**
Price data captured at a specific point in time.

```typescript
interface PriceSnapshot {
  date: string;                          // Normalized to midnight UTC
  conditionPricing: ConditionPricing[];  // Price data for each condition
  totalListingsScraped: number;          // Number of listings scraped
  scrapedAt: string;                     // Exact timestamp of scraping
}
```

#### **ConditionPricing**
Price statistics for a specific guitar condition.

```typescript
interface ConditionPricing {
  condition: GuitarCondition;  // Enum value (0-6)
  averagePrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  listingCount: number;
  currency: string;            // Default: "USD"
}
```

### Enums

#### **GuitarCondition**
Guitar condition levels matching the C# enum.

```typescript
enum GuitarCondition {
  BrandNew = 0,   // Factory sealed, never used
  Mint = 1,       // Pristine condition
  Excellent = 2,  // Minimal wear
  VeryGood = 3,   // Light wear
  Good = 4,       // Normal wear
  Fair = 5,       // Heavy wear
  Poor = 6        // Significant issues
}
```

### API Response Types

#### **GuitarListResponse**
```typescript
interface GuitarListResponse {
  total: number;
  skip: number;
  take: number;
  data: Guitar[];
}
```

#### **GuitarSearchResponse**
```typescript
interface GuitarSearchResponse {
  query: string;
  count: number;
  data: Guitar[];
}
```

#### **BrandGuitarsResponse**
```typescript
interface BrandGuitarsResponse {
  brand: string;
  count: number;
  data: Guitar[];
}
```

#### **PriceHistoryResponse**
```typescript
interface PriceHistoryResponse {
  guitarId: string;
  brand: string;
  model: string;
  year: number | null;
  count: number;
  startDate?: string | null;
  endDate?: string | null;
  priceHistory: PriceSnapshot[];
}
```

### Utility Types

```typescript
// Partial guitar for updates
type PartialGuitar = Partial<Guitar>;

// Creation payload (no id or timestamps)
type CreateGuitarPayload = Omit<Guitar, 'id' | 'createdAt' | 'updatedAt'>;

// Update payload (no id)
type UpdateGuitarPayload = Omit<PartialGuitar, 'id'>;
```

## Helper Constants

### **ConditionNames**
Human-readable condition names.

```typescript
const ConditionNames: Record<GuitarCondition, string> = {
  [GuitarCondition.BrandNew]: 'Brand New',
  [GuitarCondition.Mint]: 'Mint',
  [GuitarCondition.Excellent]: 'Excellent',
  [GuitarCondition.VeryGood]: 'Very Good',
  [GuitarCondition.Good]: 'Good',
  [GuitarCondition.Fair]: 'Fair',
  [GuitarCondition.Poor]: 'Poor',
};
```

### **ConditionColors**
Colors for charts and UI elements.

```typescript
const ConditionColors: Record<GuitarCondition, string> = {
  [GuitarCondition.BrandNew]: '#2563eb',  // Blue
  [GuitarCondition.Mint]: '#7c3aed',      // Purple
  [GuitarCondition.Excellent]: '#059669',  // Green
  [GuitarCondition.VeryGood]: '#d97706',  // Orange
  [GuitarCondition.Good]: '#dc2626',       // Red
  [GuitarCondition.Fair]: '#9333ea',       // Purple
  [GuitarCondition.Poor]: '#6b7280',       // Gray
};
```

## Helper Functions

### **getConditionName**
Get human-readable condition name from enum value.

```typescript
function getConditionName(condition: GuitarCondition): string
```

**Example:**
```typescript
getConditionName(GuitarCondition.Excellent) // "Excellent"
```

### **getConditionColor**
Get color hex code for a condition.

```typescript
function getConditionColor(condition: GuitarCondition): string
```

**Example:**
```typescript
getConditionColor(GuitarCondition.Mint) // "#7c3aed"
```

### **parseCondition**
Parse condition string to enum value.

```typescript
function parseCondition(conditionStr: string): GuitarCondition | null
```

**Example:**
```typescript
parseCondition("Very Good") // GuitarCondition.VeryGood
parseCondition("brand new") // GuitarCondition.BrandNew
parseCondition("invalid")   // null
```

### **getLatestPrice**
Get the latest price for a guitar across all conditions.

```typescript
function getLatestPrice(guitar: Guitar): { price: number | null; condition: string }
```

**Example:**
```typescript
const { price, condition } = getLatestPrice(guitar);
// { price: 2499.99, condition: "Excellent" }
```

### **formatPrice**
Format price as USD currency.

```typescript
function formatPrice(price: number | null | undefined): string
```

**Example:**
```typescript
formatPrice(2499.99) // "$2,499.99"
formatPrice(null)    // "N/A"
```

### **formatDate**
Format ISO date string to readable format.

```typescript
function formatDate(dateString: string): string
```

**Example:**
```typescript
formatDate("2026-01-08T00:00:00Z") // "January 8, 2026"
```

### **getPriceStats**
Get price statistics for a specific condition across all snapshots.

```typescript
function getPriceStats(
  priceHistory: PriceSnapshot[],
  condition: GuitarCondition
): { min: number; max: number; avg: number; count: number } | null
```

**Example:**
```typescript
const stats = getPriceStats(guitar.priceHistory, GuitarCondition.Excellent);
// { min: 2199, max: 2799, avg: 2499, count: 5 }
```

## Usage Examples

### Importing Types

```typescript
// Import specific types
import { Guitar, PriceSnapshot, GuitarCondition } from '@/types/guitar';

// Import helper functions
import { formatPrice, formatDate, getLatestPrice } from '@/types/guitar';

// Import constants
import { ConditionNames, ConditionColors } from '@/types/guitar';
```

### Using in Components

```typescript
import { Guitar, formatPrice, getLatestPrice } from '@/types/guitar';

export default function GuitarCard({ guitar }: { guitar: Guitar }) {
  const { price, condition } = getLatestPrice(guitar);

  return (
    <div>
      <h2>{guitar.brand} {guitar.model}</h2>
      <p>{formatPrice(price)} ({condition})</p>
      {guitar.year && <p>Year: {guitar.year}</p>}
    </div>
  );
}
```

### API Calls with Types

```typescript
import api from '@/lib/api';
import { Guitar, GuitarListResponse } from '@/types/guitar';

async function fetchGuitars(skip: number, take: number) {
  const response = await api.get<GuitarListResponse>(
    `/guitars?skip=${skip}&take=${take}`
  );
  return response.data; // Guitar[]
}

async function fetchGuitarById(id: string) {
  return await api.get<Guitar>(`/guitars/${id}`);
}
```

### Working with Conditions

```typescript
import { GuitarCondition, ConditionNames, getConditionColor } from '@/types/guitar';

function ConditionBadge({ condition }: { condition: GuitarCondition }) {
  const name = ConditionNames[condition];
  const color = getConditionColor(condition);

  return (
    <span style={{ backgroundColor: color }}>
      {name}
    </span>
  );
}
```

### Chart Data Transformation

```typescript
import { PriceSnapshot, ConditionNames } from '@/types/guitar';

function transformForChart(snapshots: PriceSnapshot[]) {
  return snapshots.map(snapshot => ({
    date: new Date(snapshot.date).toLocaleDateString(),
    ...snapshot.conditionPricing.reduce((acc, cp) => {
      if (cp.averagePrice !== null) {
        acc[ConditionNames[cp.condition]] = cp.averagePrice;
      }
      return acc;
    }, {} as Record<string, number>)
  }));
}
```

## Type Safety Benefits

1. **Autocomplete**: IDE provides suggestions for all properties and methods
2. **Type Checking**: Compile-time errors for type mismatches
3. **Refactoring**: Safe renaming and restructuring
4. **Documentation**: Types serve as inline documentation
5. **Backend Sync**: Matches C# models for API consistency

## Updating Types

When the backend models change:

1. Update `types/guitar.ts` to match C# models
2. Run `npm run build` to check for type errors
3. Fix any TypeScript errors in components
4. Update documentation if needed

## Best Practices

1. **Always use types** from `@/types/guitar` instead of creating local interfaces
2. **Use helper functions** for common operations (formatPrice, formatDate, etc.)
3. **Use enums** instead of magic numbers for conditions
4. **Type API responses** for better error catching
5. **Export new utilities** that could be reused across components

## Related Files

- **Types:** `types/guitar.ts`
- **API Client:** `lib/api.ts`
- **Components:**
  - `app/guitars/page.tsx` - Guitar list
  - `app/guitars/[id]/page.tsx` - Guitar details
  - `components/charts/PriceHistoryChart.tsx` - Price chart
  - `components/charts/PriceRangeChart.tsx` - Range chart
