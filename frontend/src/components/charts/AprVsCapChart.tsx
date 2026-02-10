'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface Snapshot {
  date: string;
  avgApr: string;
  totalBorrowed: string;
  borrowerCount: number;
}

interface AprVsCapChartProps {
  snapshots: Snapshot[];
  aprCap: string;
}

export function AprVsCapChart({ snapshots, aprCap }: AprVsCapChartProps) {
  const capValue = parseFloat(aprCap);

  if (!snapshots || snapshots.length === 0) {
    return (
      <Card className="border border-border/50">
        <CardHeader className="pt-6 px-8">
          <CardTitle className="flex items-center gap-3 text-xl font-serif">
            <TrendingUp className="h-4 w-4 text-primary/60" />
            APR vs Cap
          </CardTitle>
        </CardHeader>
        <CardContent className="px-8 pb-8">
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
            No snapshot data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = [...snapshots]
    .reverse()
    .map(s => ({
      date: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      apr: parseFloat(s.avgApr),
    }));

  return (
    <Card className="border border-border/50">
      <CardHeader className="pt-6 px-8 pb-2">
        <CardTitle className="flex items-center gap-3 text-xl font-serif">
          <TrendingUp className="h-4 w-4 text-primary/60" />
          APR vs Cap
        </CardTitle>
        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">
          Recent snapshots &middot; Cap: {capValue}%
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.3)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#F5F5F7',
                  border: '1px solid hsl(var(--border) / 0.5)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
                  padding: '12px 16px',
                }}
                formatter={(value: number) => [`${value.toFixed(2)}%`, 'Actual APR']}
              />
              <ReferenceLine
                y={capValue}
                stroke="hsl(var(--destructive))"
                strokeDasharray="6 4"
                strokeWidth={1.5}
                label={{
                  value: `Cap ${capValue}%`,
                  position: 'right',
                  fontSize: 10,
                  fill: 'hsl(var(--destructive))',
                }}
              />
              <Line
                type="monotone"
                dataKey="apr"
                stroke="#1e293b"
                strokeWidth={2}
                dot={{ r: 3, fill: '#1e293b' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
