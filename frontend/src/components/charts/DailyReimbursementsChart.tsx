'use client';

import { useDailyMetrics } from '@/hooks/useMetrics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ReimbursementChart } from './ReimbursementChart';
import { AlertTriangle, CheckCircle } from 'lucide-react';

export function DailyReimbursementsChart() {
  const { data, loading, error } = useDailyMetrics(30);

  if (loading) {
    return (
      <Card className="h-full border border-border/50">
        <CardHeader className="pt-6 px-6 pb-2">
          <CardTitle className="font-serif text-xl">Daily Reimbursements</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-72 animate-pulse bg-muted/30 rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card className="h-full border border-border/50 border-destructive/20 bg-destructive/5">
        <CardHeader className="pt-6 px-6 pb-2">
          <CardTitle className="font-serif text-xl">Daily Reimbursements</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="h-72 flex items-center justify-center">
            <div className="text-center">
              <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium text-sm">Unable to load chart data</p>
              <p className="text-muted-foreground text-xs mt-1">Please try again later</p>
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
        <CardHeader className="pt-6 px-6 pb-2">
          <CardTitle className="font-serif text-xl">Daily Reimbursements</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
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