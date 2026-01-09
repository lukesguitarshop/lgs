'use client';

import {
  LineChart,
  Line,
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

// Sample data for demonstration
const sampleData = [
  { month: 'Jan', guitars: 120, revenue: 45000 },
  { month: 'Feb', guitars: 150, revenue: 52000 },
  { month: 'Mar', guitars: 180, revenue: 61000 },
  { month: 'Apr', guitars: 165, revenue: 58000 },
  { month: 'May', guitars: 195, revenue: 68000 },
  { month: 'Jun', guitars: 210, revenue: 75000 },
];

export function ExampleLineChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Line Chart</CardTitle>
        <CardDescription>Monthly guitar sales trend</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sampleData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="guitars"
              stroke="#2563eb"
              strokeWidth={2}
              name="Guitars Sold"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ExampleBarChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Bar Chart</CardTitle>
        <CardDescription>Monthly revenue comparison</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sampleData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(value: any) => `$${value.toLocaleString()}`} />
            <Legend />
            <Bar dataKey="revenue" fill="#059669" name="Revenue" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function ExampleMultiLineChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Example Multi-Line Chart</CardTitle>
        <CardDescription>Guitars sold vs revenue trend</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={sampleData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="guitars"
              stroke="#2563eb"
              strokeWidth={2}
              name="Guitars"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="revenue"
              stroke="#059669"
              strokeWidth={2}
              name="Revenue ($)"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
