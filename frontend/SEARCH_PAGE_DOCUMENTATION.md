# Search Page Documentation

## Overview

The Search Page (`app/search/page.tsx`) provides advanced filtering and search capabilities for the Guitar Price Database.

## Features

### 🎯 Advanced Filters

#### 1. **Search Query**
- Real-time text search across multiple fields
- Searches: brand, model, year, finish
- Case-insensitive matching

#### 2. **Brand Filter**
- Dropdown with all available brands
- Auto-populated from guitar database
- Alphabetically sorted

#### 3. **Category Filter**
- Filter by guitar category (Electric, Acoustic, etc.)
- Dropdown populated from database
- Alphabetically sorted

#### 4. **Year Range Slider**
- Dual-handle slider for min/max year selection
- Range: 1950 to current year
- Manual input fields for precise values
- Live display of selected range

#### 5. **Price Range Slider**
- Dual-handle slider for min/max price
- Range: $0 to $50,000
- Manual input fields for precise values
- Formatted currency display

#### 6. **Condition Checkboxes**
- Multi-select checkboxes for guitar conditions
- Options: Brand New, Mint, Excellent, Very Good, Good, Fair
- Filters guitars with matching condition pricing

### 🔍 URL Query Parameters

All filter states are preserved in URL query parameters for:
- Sharable filtered results
- Browser back/forward navigation
- Bookmarking specific searches

**Query Parameters:**
- `q` - Search query
- `brand` - Selected brand
- `category` - Selected category
- `yearMin` - Minimum year
- `yearMax` - Maximum year
- `priceMin` - Minimum price
- `priceMax` - Maximum price
- `conditions` - Comma-separated condition IDs

**Example URL:**
```
/search?brand=Gibson&yearMin=2000&yearMax=2023&priceMin=2000&priceMax=5000&conditions=1,2
```

### 📱 Responsive Design

#### Desktop (> 1024px)
- Fixed sidebar on left (320px width)
- Main results grid on right (3 columns)
- Sticky filter sidebar

#### Tablet (768px - 1024px)
- Collapsible sidebar
- 2-column results grid

#### Mobile (< 768px)
- Hidden sidebar by default
- Toggle button to show/hide filters
- 1-column results grid
- Full-width filter panel when open

### 🎨 UI Components

#### Filter Sidebar
- Sticky positioning (stays in view while scrolling)
- Active filter count badge
- "Apply Filters" button
- "Clear All" button (only shown when filters active)
- Close button (mobile only)

#### Results Grid
- Guitar cards with images
- Price badges
- Hover effects
- Click to view details

#### Loading States
- Skeleton cards during data fetch
- 9 skeleton cards in grid layout
- Animated pulse effect

#### Empty States
- Large guitar emoji (🎸)
- Clear "No results" message
- Helpful suggestions:
  - Clear filters button
  - Browse all guitars link

### 💻 Technical Implementation

#### Client-Side Filtering
```typescript
const filteredGuitars = useMemo(() => {
  return guitars.filter((guitar) => {
    // Search query filter
    // Brand filter
    // Category filter
    // Year range filter
    // Price range filter
    // Condition filter
  });
}, [guitars, searchQuery, selectedBrand, /* other filters */]);
```

#### URL State Management
```typescript
// Read from URL on mount
const searchParams = useSearchParams();
const [searchQuery, setSearchQuery] = useState(
  searchParams.get('q') || ''
);

// Update URL when applying filters
const updateURL = () => {
  const params = new URLSearchParams();
  if (searchQuery) params.set('q', searchQuery);
  // ... set other params
  router.push(`/search?${params.toString()}`);
};
```

#### Filter State
All filter values stored in local component state:
- `searchQuery` - Text search
- `selectedBrand` - Brand filter
- `selectedCategory` - Category filter
- `yearMin` / `yearMax` - Year range
- `priceMin` / `priceMax` - Price range
- `selectedConditions` - Array of condition IDs

### 🎯 Filter Logic

#### Text Search
Matches any of:
- Brand name
- Model name
- Year
- Finish

#### Year Range
```typescript
if (guitar.year) {
  if (guitar.year < yearMin || guitar.year > yearMax) {
    return false;
  }
}
```

#### Price Range
Uses latest price from price history:
```typescript
const { price } = getLatestPrice(guitar);
if (price !== null) {
  if (price < priceMin || price > priceMax) {
    return false;
  }
}
```

#### Condition Filter
Checks if guitar has pricing data for selected conditions:
```typescript
if (selectedConditions.length > 0) {
  const latestSnapshot = guitar.priceHistory?.[0];
  const hasMatchingCondition = latestSnapshot.conditionPricing.some(
    (cp) => selectedConditions.includes(cp.condition) && cp.averagePrice !== null
  );
  if (!hasMatchingCondition) return false;
}
```

### 🚀 Performance Optimizations

1. **Memoization**
   - `brands` and `categories` lists memoized
   - `filteredGuitars` memoized with all dependencies
   - `activeFiltersCount` memoized

2. **Lazy Filtering**
   - Filters not applied until "Apply Filters" clicked
   - URL only updates on explicit action

3. **Efficient Re-renders**
   - useMemo for expensive computations
   - Minimal state updates

### 📊 Data Flow

```
1. Component mounts
   ↓
2. Fetch all guitars from API
   ↓
3. Read filter state from URL params
   ↓
4. User adjusts filters (local state only)
   ↓
5. User clicks "Apply Filters"
   ↓
6. Update URL with new params
   ↓
7. Filter guitars based on criteria
   ↓
8. Display filtered results
```

### 🎨 Color Scheme

- **Primary Blue**: #2563eb (filters, buttons)
- **Badge**: #2563eb (active filter count)
- **Hover**: #1d4ed8 (darker blue)
- **Borders**: #e5e7eb (light gray)
- **Text**: #111827 (dark gray)

### 📱 Mobile Considerations

- Touch-friendly hit areas (44px minimum)
- Large filter toggle button
- Full-screen filter panel
- Swipe-friendly cards
- Optimized for single-hand use

### 🔗 Navigation Integration

Search page is accessible from:
1. Header navigation (global)
2. Footer links
3. Empty state on home page
4. Direct URL access

### 🎯 User Workflows

#### Workflow 1: Brand + Price Search
1. Select brand from dropdown
2. Adjust price range slider
3. Click "Apply Filters"
4. View filtered results

#### Workflow 2: Condition + Year Search
1. Check desired conditions
2. Adjust year range
3. Click "Apply Filters"
4. Browse results by condition

#### Workflow 3: Text Search Only
1. Type search query
2. Click "Apply Filters"
3. See matching guitars

### 🐛 Error Handling

- **API Failure**: Shows empty results, doesn't crash
- **Invalid URL Params**: Gracefully defaults to safe values
- **No Data**: Shows helpful empty state

### 🔮 Future Enhancements

Potential improvements:
- Save filter presets
- Recent searches
- Sort options (price, year, brand)
- Infinite scroll
- Export results to CSV
- Compare selected guitars
- Price alerts for saved searches
- Advanced filters (finish, specifications)

### 📦 Dependencies

- `next/navigation` - Router and search params
- `lucide-react` - Icons (Search, Filter, X, SlidersHorizontal)
- `shadcn/ui` - Card, Button, Badge, Input, Slider
- `@/types/guitar` - TypeScript types
- `@/lib/api` - API client

### 🔗 Related Pages

- `/` - Homepage with basic search
- `/guitars/[id]` - Individual guitar details
- `/charts` - Price chart showcase

## Example Usage

### Basic Search
Visit `/search` to see all guitars with no filters applied.

### Filtered Search
Visit `/search?brand=Gibson&yearMin=2000&priceMax=5000` to see:
- Gibson guitars only
- From year 2000 onwards
- Under $5,000

### Condition Search
Visit `/search?conditions=1,2` to see:
- Guitars in Mint (1) or Excellent (2) condition

## API Endpoint

The search page fetches data from:
```
GET /api/guitars?skip=0&take=500
```

Returns up to 500 guitars for client-side filtering.

## File Location

**Path:** `app/search/page.tsx`

**Type:** Client Component (`'use client'`)

**Lines of Code:** ~600

## Testing

1. **Load Page**: Visit http://localhost:3000/search
2. **Apply Filters**: Select various filters and verify results
3. **URL State**: Check URL updates when applying filters
4. **Clear Filters**: Verify all filters reset
5. **Mobile**: Test responsive behavior on mobile devices
6. **Edge Cases**: Test empty results, no filters, etc.

## Keyboard Shortcuts

- **Tab**: Navigate through filters
- **Enter**: Apply filters (when focused on input)
- **Escape**: Clear search query (when focused on search input)

## Accessibility

- ✅ Semantic HTML
- ✅ Keyboard navigation
- ✅ ARIA labels on inputs
- ✅ Focus indicators
- ✅ Screen reader compatible
