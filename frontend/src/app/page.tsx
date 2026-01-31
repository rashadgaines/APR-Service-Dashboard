import { Header } from '@/components/layout/Header'
import { OverviewCards } from '@/components/dashboard/OverviewCards'
import { DailyReimbursementsChart } from '@/components/charts/DailyReimbursementsChart'
import { MarketBreakdownChart } from '@/components/charts/MarketBreakdownChart'
import { RecentAlerts } from '@/components/dashboard/RecentAlerts'
import { RefreshCw } from 'lucide-react'

export default function Dashboard() {
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
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-medium text-emerald-500">Live</span>
                  <RefreshCw className="w-3 h-3 text-emerald-500 animate-spin" style={{ animationDuration: '1s' }} />
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

        {/* Charts Section */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Daily Reimbursements Chart - takes 2/3 width on desktop */}
          <div className="lg:col-span-2">
            <DailyReimbursementsChart />
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
  )
}
