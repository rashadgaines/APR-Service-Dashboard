'use client';

import { useDailyMetrics } from '@/hooks/useMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ReimbursementChart } from './ReimbursementChart';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

export function DailyReimbursementsChart() {
  const { data, loading, error } = useDailyMetrics(30);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Daily Reimbursements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 animate-pulse bg-muted/50 rounded-lg flex items-center justify-center">
            <div className="text-muted-foreground text-sm">Loading chart data...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="h-full border-destructive/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Daily Reimbursements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">Unable to load chart data</p>
              <p className="text-muted-foreground text-sm mt-1">Please try again later</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate daily reimbursement amounts
  const dailyData = data.data.map(item => {
    const amount = parseFloat(item.amount);
    return {
      date: typeof item.date === 'string' ? item.date : new Date(item.date).toISOString().slice(0, 10),
      amount,
      count: item.count,
    };
  });

  const totalReimbursements = dailyData.reduce((sum, d) => sum + d.amount, 0);
  const hasData = totalReimbursements > 0;
  const last7 = dailyData.slice(-7);



  return (
    !hasData ? (
      <Card className="h-full border border-border/50">
        <CardHeader className="pb-3 pt-6 px-6">
          <CardTitle className="flex items-center gap-2 text-lg font-serif">
            <TrendingUp className="h-4 w-4 text-primary/70" />
            Daily Reimbursements
          </CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle className="h-12 w-12 text-emerald-500/40 mb-3" />
            <p className="font-serif text-base text-foreground/70">All Caps Respected</p>
            <p className="text-muted-foreground text-xs mt-1">No reimbursements needed</p>
          </div>
        </CardContent>
      </Card>
    ) : (
      <ReimbursementChart data={last7} />
    )
  );
}