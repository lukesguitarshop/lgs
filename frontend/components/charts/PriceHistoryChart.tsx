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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PriceSnapshot, GuitarCondition, ConditionNames, ConditionColors } from '@/types/guitar';

interface PriceHistoryChartProps {
  priceHistory: PriceSnapshot[];
  selectedCondition?: GuitarCondition;
}

export default function PriceHistoryChart({ priceHistory, selectedCondition }: PriceHistoryChartProps) {
  // Transform data for the chart
  const chartData = priceHistory
    .slice()
    .reverse() // Show oldest to newest
    .map((snapshot) => {
      const dataPoint: any = {
        date: new Date(snapshot.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: snapshot.date,
      };

      snapshot.conditionPricing.forEach((cp) => {
        if (cp.averagePrice !== null) {
          const conditionName = ConditionNames[cp.condition];
          dataPoint[conditionName] = cp.averagePrice;
          dataPoint[`${conditionName}_min`] = cp.minPrice;
          dataPoint[`${conditionName}_max`] = cp.maxPrice;
        }
      });

      return dataPoint;
    });

  // Determine which conditions to display
  const conditionsToShow = selectedCondition !== undefined
    ? [selectedCondition]
    : Array.from(new Set(
        priceHistory.flatMap(snapshot =>
          snapshot.conditionPricing
            .filter(cp => cp.averagePrice !== null)
            .map(cp => cp.condition)
        )
      ));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Price History Chart</CardTitle>
          <CardDescription>No price data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">No price history to display</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Price History Chart</CardTitle>
        <CardDescription>
          Average price trends across different conditions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => `$${value.toLocaleString()}`}
            />
            <Tooltip
              formatter={(value: any) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend />
            {conditionsToShow.map((condition) => (
              <Line
                key={condition}
                type="monotone"
                dataKey={ConditionNames[condition]}
                stroke={ConditionColors[condition]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={ConditionNames[condition]}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
