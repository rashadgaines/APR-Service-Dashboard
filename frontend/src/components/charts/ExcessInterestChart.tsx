'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import type { ExcessInterestMarket } from '@/types';
import { TrendingUp } from 'lucide-react';

export function ExcessInterestChart() {
  const [data, setData] = useState<ExcessInterestMarket[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .getExcessInterest<ExcessInterestMarket[]>(30)
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border border-border/50">
        <CardHeader className="pt-6 px-6">
          <CardTitle className="font-serif text-xl">Excess Interest by Market</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-48 animate-pulse bg-muted/30 rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border border-border/50">
        <CardHeader className="pt-6 px-6">
          <CardTitle className="font-serif text-xl">Excess Interest by Market</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-48 flex flex-col items-center justify-center text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="font-serif text-sm text-foreground/70">No Excess Interest</p>
            <p className="text-muted-foreground text-xs mt-1">All markets within APR caps</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.map(m => ({
    name: m.marketName,
    value: parseFloat(m.totalExcessUsd),
  }));

  return (
    <Card className="border border-border/50">
      <CardHeader className="pt-6 px-6 pb-2">
        <CardTitle className="font-serif text-xl">Excess Interest by Market</CardTitle>
        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">
          30-day window
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#F5F5F7',
                  border: '1px solid hsl(var(--border) / 0.5)',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
                  padding: '12px 16px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Excess Interest']}
              />
              <Bar dataKey="value" fill="#1e293b" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
