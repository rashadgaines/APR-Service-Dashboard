'use client';

import { useMarketMetrics } from '@/hooks/useMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { Database } from 'lucide-react';

// Use the same blue as the bar chart (#1e293b) and lighter tints
const ARCH_COLORS = [
  '#1e293b', // deep blue (primary)
  'rgba(30,41,59,0.7)',
  'rgba(30,41,59,0.5)',
  'rgba(30,41,59,0.3)',
  'rgba(30,41,59,0.15)',
];

export function MarketBreakdownChart() {
  const { data, loading, error } = useMarketMetrics();

  if (loading) {
    return (
      <Card className="border border-border/50">
        <CardHeader className="pt-6 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="font-serif">Market Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-64 animate-pulse bg-muted/30 rounded-2xl"></div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/20 bg-destructive/5 border-border/50">
        <CardHeader className="pt-6 px-6">
          <CardTitle className="font-serif">Market Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <p className="text-destructive text-sm font-medium">Failed to load market data: {error}</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate total first to avoid division by zero
  const totalValue = data.markets?.reduce((sum, market) => sum + parseFloat(market.totalBorrowed || '0'), 0) || 0;
  const hasMarkets = data.markets && data.markets.length > 0 && totalValue > 0;

  // Transform data for pie chart
  const chartData = hasMarkets
    ? data.markets.map((market, index) => ({
        name: market.name,
        value: parseFloat(market.totalBorrowed || '0'),
        percentage: ((parseFloat(market.totalBorrowed || '0') / totalValue) * 100).toFixed(1),
        color: ARCH_COLORS[index % ARCH_COLORS.length],
      }))
    : [];

  return (
    <Card className="border border-border/50">
      <CardHeader className="pt-6 px-6 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="font-serif text-xl">Market Breakdown</CardTitle>
        </div>
        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">
          TVL: {formatCurrency(totalValue)}
        </p>
      </CardHeader>
      <CardContent className="p-6">
        {!hasMarkets ? (
          <div className="h-64 flex flex-col items-center justify-center text-center">
            <Database className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="font-serif text-base text-foreground/70">No Market Data</p>
            <p className="text-muted-foreground text-xs mt-1">Waiting for position sync</p>
          </div>
        ) : (
          <>
            <div className="h-64 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#F5F5F7',
                      border: '1px solid hsl(var(--border) / 0.5)',
                      borderRadius: '16px',
                      boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)',
                      padding: '12px 16px',
                    }}
                    itemStyle={{ fontSize: '12px', fontWeight: 600, color: 'hsl(var(--primary))' }}
                    labelStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'hsl(var(--muted-foreground))', marginBottom: '4px' }}
                    formatter={(value: number) => [formatCurrency(value), 'TVL']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Market List */}
            <div className="space-y-3">
              {chartData.map((market) => (
                <div key={market.name} className="flex items-center justify-between text-xs group">
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-1.5 h-1.5 rounded-full ring-2 ring-background ring-offset-1"
                      style={{ backgroundColor: market.color }}
                    />
                    <span className="text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                      {market.name}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground/80">{market.percentage}%</span>
                    <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                      {formatCurrency(market.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}