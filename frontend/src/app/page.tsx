'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { DailyReimbursementsChart } from '@/components/charts/DailyReimbursementsChart';
import { MarketBreakdownChart } from '@/components/charts/MarketBreakdownChart';
import { ExcessInterestChart } from '@/components/charts/ExcessInterestChart';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { apiClient } from '@/lib/api';
import type { AnalyticsEfficiency } from '@/types';
import { RefreshCw, Clock, Zap } from 'lucide-react';

export default function Dashboard() {
  const [efficiency, setEfficiency] = useState<AnalyticsEfficiency | null>(null);
  const [wsRefreshKey, setWsRefreshKey] = useState(0);

  // Fetch efficiency metrics
  useEffect(() => {
    apiClient
      .getAnalyticsEfficiency<AnalyticsEfficiency>(30)
      .then(setEfficiency)
      .catch(() => {});
  }, [wsRefreshKey]);

  // WebSocket real-time updates
  const handlePositionsSynced = useCallback(() => {
    setWsRefreshKey(k => k + 1);
  }, []);

  const handleReimbursementsExecuted = useCallback(() => {
    setWsRefreshKey(k => k + 1);
  }, []);

  const { isConnected } = useRealtimeUpdates({
    onPositionsSynced: handlePositionsSynced,
    onReimbursementsExecuted: handleReimbursementsExecuted,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-12 lg:px-8 max-w-7xl">
        {/* Hero Section with Real-time Indicator */}
        <div className="mb-8 sm:mb-16">
          <div className="flex items-start gap-3 sm:gap-4 mb-3">
            <div className="h-10 sm:h-12 w-[1px] bg-primary/30 mt-1 hidden sm:block" />
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-1">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-bold tracking-tight text-foreground">
                  APR Service Dashboard
                </h1>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 w-fit">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span className={`text-xs font-medium ${isConnected ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {isConnected ? 'Live' : 'Polling'}
                  </span>
                  <RefreshCw className={`w-3 h-3 ${isConnected ? 'text-emerald-500' : 'text-amber-500'} animate-spin`} style={{ animationDuration: '1s' }} />
                </div>
              </div>
              <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed text-sm sm:text-base">
                Real-time monitoring and APR cap enforcement for Morpho lending pools on Polygon.
                <span className="hidden sm:inline"> Ensuring market stability through automated reimbursement processing.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Overview Metrics */}
        <section className="mb-6 sm:mb-8">
          <OverviewCards />
        </section>

        {/* Operational Efficiency Card */}
        {efficiency && efficiency.sampleSize > 0 && (
          <section className="mb-6 sm:mb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-card border border-border/50 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-3.5 w-3.5 text-primary/60" />
                  <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    Median Response
                  </span>
                </div>
                <p className="text-2xl font-serif font-bold text-foreground/80">
                  {efficiency.medianMinutes < 60
                    ? `${efficiency.medianMinutes}m`
                    : `${(efficiency.medianMinutes / 60).toFixed(1)}h`}
                </p>
              </div>
              <div className="bg-card border border-border/50 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3.5 w-3.5 text-primary/60" />
                  <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    P95 Response
                  </span>
                </div>
                <p className="text-2xl font-serif font-bold text-foreground/80">
                  {efficiency.p95Minutes < 60
                    ? `${efficiency.p95Minutes}m`
                    : `${(efficiency.p95Minutes / 60).toFixed(1)}h`}
                </p>
              </div>
              <div className="bg-card border border-border/50 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                    Sample Size
                  </span>
                </div>
                <p className="text-2xl font-serif font-bold text-foreground/80">
                  {efficiency.sampleSize}
                </p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">reimbursements (30d)</p>
              </div>
            </div>
          </section>
        )}

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 items-start gap-4 sm:gap-6">
          {/* Daily Reimbursements + Excess Interest */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <DailyReimbursementsChart />
            <ExcessInterestChart />
          </div>

          {/* Sidebar - Market Breakdown and Alerts */}
          <div className="space-y-4 sm:space-y-6">
            <MarketBreakdownChart />
            <RecentAlerts />
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 sm:mt-12 pt-4 sm:pt-6 border-t border-border">
          <div className="flex flex-col gap-2 text-xs text-muted-foreground">
            <p>Gondor APR Service v1.0.0</p>
            <p className="text-muted-foreground/60 text-[10px] sm:text-[11px]">
              Data sources: Morpho Protocol, CoinGecko, Polygon RPC
            </p>
          </div>
        </footer>
      </main>
    </div>
  );
}
