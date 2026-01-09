# shadcn/ui Setup Guide

## Installation Summary

shadcn/ui has been successfully installed and configured in this Next.js project.

## Installed Components

The following shadcn/ui components are available:

1. **Button** (`@/components/ui/button`)
2. **Card** (`@/components/ui/card`)
3. **Table** (`@/components/ui/table`)
4. **Input** (`@/components/ui/input`)
5. **Select** (`@/components/ui/select`)
6. **Badge** (`@/components/ui/badge`)
7. **Tabs** (`@/components/ui/tabs`)

## Configuration Files

### `components.json`
Contains the shadcn/ui configuration for the project:
- Style: New York
- Base color: Neutral
- CSS variables: Enabled
- TypeScript: Enabled

### `lib/utils.ts`
Contains the `cn()` utility function for merging Tailwind classes:
```typescript
import { cn } from "@/lib/utils"
```

### `app/globals.css`
Updated with shadcn/ui CSS variables for theming:
- Light and dark mode color schemes
- HSL color format for easy customization
- Semantic color tokens (background, foreground, primary, etc.)

### `tailwind.config.ts`
Configured with shadcn/ui requirements:
- Border radius variables
- Content paths for component scanning

## Usage Examples

### Button
```tsx
import { Button } from "@/components/ui/button"

<Button>Click me</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Outline</Button>
<Button size="lg">Large Button</Button>
```

### Card
```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
</Card>
```

### Table
```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Item 1</TableCell>
      <TableCell>Active</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Input
```tsx
import { Input } from "@/components/ui/input"

<Input type="text" placeholder="Enter text..." />
<Input type="email" placeholder="Email address" />
```

### Select
```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

### Badge
```tsx
import { Badge } from "@/components/ui/badge"

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

### Tabs
```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">
    Content for Tab 1
  </TabsContent>
  <TabsContent value="tab2">
    Content for Tab 2
  </TabsContent>
</Tabs>
```

## Test Page

Visit `/components-test` to see all components in action with various examples.

## Adding More Components

To add additional shadcn/ui components:

```bash
npx shadcn@latest add [component-name] --yes
```

Examples:
```bash
npx shadcn@latest add dialog --yes
npx shadcn@latest add dropdown-menu --yes
npx shadcn@latest add toast --yes
```

## Dependencies

The following packages were installed:
- `@radix-ui/react-select` - Headless select component
- `@radix-ui/react-slot` - Polymorphic component utility
- `@radix-ui/react-tabs` - Headless tabs component
- `class-variance-authority` - CVA for variant management
- `clsx` - Utility for constructing className strings
- `tailwind-merge` - Merge Tailwind classes without conflicts
- `lucide-react` - Icon library

## Theming

Colors are defined using HSL format in `app/globals.css`. To customize the theme:

1. Modify the CSS variables in the `:root` selector for light mode
2. Modify the `.dark` selector for dark mode
3. All components will automatically use the new color scheme

Example:
```css
:root {
  --primary: 221 83% 53%;  /* Custom blue */
}
```

## Documentation

For more information, visit:
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Radix UI Documentation](https://www.radix-ui.com/primitives)
