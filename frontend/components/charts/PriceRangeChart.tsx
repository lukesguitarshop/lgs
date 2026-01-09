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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceSnapshot, ConditionNames } from '@/types/guitar';

interface PriceRangeChartProps {
  priceHistory: PriceSnapshot[];
}

export default function PriceRangeChart({ priceHistory }: PriceRangeChartProps) {
  if (!priceHistory || priceHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Range by Condition</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No price data to display</p>
        </CardContent>
      </Card>
    );
  }

  // Get the latest snapshot
  const latestSnapshot = priceHistory[0];

  // Transform data for the chart
  const chartData = latestSnapshot.conditionPricing
    .filter(cp => cp.averagePrice !== null && cp.listingCount > 0)
    .map(cp => ({
      condition: ConditionNames[cp.condition],
      min: cp.minPrice,
      avg: cp.averagePrice,
      max: cp.maxPrice,
      listings: cp.listingCount,
    }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price Range by Condition</CardTitle>
          <CardDescription>No price data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No pricing data for any condition</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price Range by Condition</CardTitle>
        <CardDescription>
          Latest snapshot showing min, average, and max prices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="condition"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={100}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'listings') {
                  return [value, 'Listings'];
                }
                return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, name];
              }}
            />
            <Legend />
            <Bar dataKey="min" fill="#60a5fa" name="Min Price" />
            <Bar dataKey="avg" fill="#2563eb" name="Avg Price" />
            <Bar dataKey="max" fill="#1e40af" name="Max Price" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
