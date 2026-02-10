'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import {
  ArrowLeft,
  TrendingUp,
  Users,
  AlertTriangle,
  Loader2,
  Percent,
  Shield,
  DollarSign,
  ExternalLink,
} from 'lucide-react';
import { AprVsCapChart } from '@/components/charts/AprVsCapChart';

interface MarketDetail {
  id: string;
  marketId: string;
  name: string;
  collateralAsset: string;
  loanAsset: string;
  lltv: string;
  aprCap: string;
  vaultAddress: string;
  borrowerCount: number;
  totalBorrowed: string;
  aboveCapCount: number;
  currentApr?: number;
  positions?: Array<{
    id: string;
    borrowerAddress: string;
    principal: string;
    collateral: string;
    isActive: boolean;
    openedAt: string;
  }>;
  snapshots?: Array<{
    date: string;
    avgApr: string;
    totalBorrowed: string;
    borrowerCount: number;
  }>;
}

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.id as string;
  const [market, setMarket] = useState<MarketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarket = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getMarket<any>(marketId);
        if (data.market) {
          setMarket({
            ...data.market,
            positions: data.positions,
            snapshots: data.recentSnapshots
          });
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch market');
      } finally {
        setLoading(false);
      }
    };

    if (marketId) {
      fetchMarket();
    }
  }, [marketId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Header />
        <main className="container mx-auto px-6 py-12 lg:px-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-background text-foreground font-sans">
        <Header />
        <main className="container mx-auto px-6 py-12 lg:px-8 max-w-7xl">
          <Link
            href="/markets"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary mb-8 group transition-colors"
          >
            <ArrowLeft className="h-3 w-3 transform group-hover:-translate-x-0.5 transition-transform" />
            Back to Markets
          </Link>
          <Card className="border-destructive/20 bg-destructive/5 border-border/50">
            <CardContent className="p-12 text-center">
              <AlertTriangle className="h-10 w-10 text-destructive/50 mx-auto mb-4" />
              <p className="text-destructive font-serif text-lg">
                {error || 'Market data unavailable'}
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const aprCapPercent = parseFloat(market.aprCap) || 0;
  const currentAprPercent = typeof market.currentApr === 'string' ? parseFloat(market.currentApr) : market.currentApr || 0;
  const aprRatio = aprCapPercent > 0 ? currentAprPercent / aprCapPercent : 0;
  const isAboveCap = currentAprPercent > aprCapPercent;

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="container mx-auto px-6 py-12 lg:px-8 max-w-7xl">
        {/* Back Link */}
        <Link
          href="/markets"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary mb-12 group transition-colors"
        >
          <ArrowLeft className="h-3 w-3 transform group-hover:-translate-x-0.5 transition-transform" />
          Back to Markets
        </Link>

        {/* Market Header */}
        <div className="mb-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-[1px] bg-primary/30 mt-1" />
              <div>
                <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground/90">
                  {market.name}
                </h1>
                <p className="text-muted-foreground mt-2 font-medium">
                  {market.collateralAsset} Collateral / {market.loanAsset} Debt
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {market.aboveCapCount > 0 ? (
                <Badge variant="destructive" className="px-4 py-1.5 animate-pulse text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                  {market.aboveCapCount} Issue{market.aboveCapCount > 1 ? 's' : ''} detected
                </Badge>
              ) : (
                <Badge
                  variant="secondary"
                  className="px-4 py-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-xs"
                >
                  Market Healthy
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <Percent className="h-3 w-3" />
                APR Cap
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-serif font-bold text-primary">
                  {aprCapPercent.toFixed(0)}%
                </p>
                {market.currentApr !== undefined && (
                  <p className={`text-xs font-medium ${isAboveCap ? 'text-destructive' : 'text-muted-foreground/60'}`}>
                    (Now: {currentAprPercent.toFixed(2)}%)
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <Shield className="h-3 w-3" />
                Max LLTV
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-serif font-bold text-foreground/80">
                {(parseFloat(market.lltv) * 100).toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <Users className="h-3 w-3" />
                Borrowers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-serif font-bold text-foreground/80">
                {formatNumber(market.borrowerCount)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <DollarSign className="h-3 w-3" />
                Total Borrowed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-serif font-bold text-foreground/80">
                {formatCurrency(market.totalBorrowed)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Market Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="pt-6 px-8">
              <CardTitle className="flex items-center gap-3 text-xl font-serif">
                <TrendingUp className="h-4 w-4 text-primary/60" />
                Market Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="space-y-0">
                <div className="flex justify-between py-4 border-b border-border/30 group">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Market ID</span>
                  <span className="font-mono text-xs text-foreground/80 bg-muted/50 px-2 py-0.5 rounded">
                    {market.marketId}
                  </span>
                </div>
                <div className="flex justify-between py-4 border-b border-border/30 group">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Vault Address</span>
                  <a
                    href={`https://polygonscan.com/address/${market.vaultAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs text-primary hover:underline flex items-center gap-1.5"
                  >
                    {market.vaultAddress}
                    <ExternalLink className="h-3 w-3 opacity-40" />
                  </a>
                </div>
                <div className="flex justify-between py-4 border-b border-border/30">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Collateral</span>
                  <span className="text-sm font-serif font-bold text-foreground/80">{market.collateralAsset}</span>
                </div>
                <div className="flex justify-between py-4 border-b border-border/30">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Loan Asset</span>
                  <span className="text-sm font-serif font-bold text-foreground/80">{market.loanAsset}</span>
                </div>
                <div className="flex justify-between py-4">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Monitoring Status</span>
                  <span className={`text-[10px] font-sans font-bold uppercase tracking-widest ${market.aboveCapCount > 0 ? 'text-destructive' : 'text-emerald-600'}`}>
                    {market.aboveCapCount > 0 ? `${market.aboveCapCount} Position(s) Flagged` : 'All Compliant'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* APR Status */}
          <Card className="border-border/50 bg-primary/[0.02]">
            <CardHeader className="pt-6 px-8">
              <CardTitle className="text-xl font-serif">APR Compliance</CardTitle>
            </CardHeader>
            <CardContent className="px-8 pb-8">
              <div className="relative pt-4">
                <div className="flex justify-between mb-3">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Current APR</span>
                  <span className={`text-lg font-serif font-bold ${isAboveCap ? 'text-destructive' : 'text-primary'}`}>
                    {currentAprPercent.toFixed(2)}%
                  </span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-1.5 relative overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${isAboveCap ? 'bg-destructive' : 'bg-primary'
                      }`}
                    style={{ width: `${Math.min(aprRatio * 100, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-3">
                  <span className="text-[9px] font-sans font-bold text-muted-foreground/40 uppercase tracking-widest">Target: {aprCapPercent}%</span>
                  <span className={`text-[9px] font-sans font-bold uppercase tracking-widest ${isAboveCap ? 'text-destructive' : 'text-emerald-600'}`}>
                    {isAboveCap ? `+${((aprRatio - 1) * 100).toFixed(1)}% Bound` : 'Within Limits'}
                  </span>
                </div>

                {isAboveCap && (
                  <div className="mt-8 p-4 rounded-xl bg-destructive/5 border border-destructive/10">
                    <p className="text-xs text-destructive leading-relaxed flex items-start gap-2 italic">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      Automatic rebalancing triggered. Reimbursement calculating for eligible borrowers.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* APR vs Cap Chart */}
        {market.snapshots && market.snapshots.length > 0 && (
          <div className="mb-16">
            <AprVsCapChart snapshots={market.snapshots} aprCap={market.aprCap} />
          </div>
        )}

        {/* All Positions */}
        {market.positions && market.positions.length > 0 && (
          <PositionsTable positions={market.positions} />
        )}
      </main>
    </div>
  );
}

const PAGE_SIZE = 25;

function PositionsTable({ positions }: { positions: NonNullable<MarketDetail['positions']> }) {
  const [page, setPage] = useState(0);
  const [showAll, setShowAll] = useState(false);

  const totalCount = positions.length;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const needsPagination = totalCount > PAGE_SIZE;

  const visiblePositions = useMemo(() => {
    if (showAll) return positions;
    return positions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [positions, page, showAll]);

  const startIdx = showAll ? 1 : page * PAGE_SIZE + 1;
  const endIdx = showAll ? totalCount : Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <Card className="border-border/50">
      <CardHeader className="pt-6 px-8 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-3 text-xl font-serif">
          <Users className="h-4 w-4 text-primary/60" />
          All Positions
        </CardTitle>
        <Badge variant="secondary" className="px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-widest">
          {totalCount} Total
        </Badge>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left py-4 px-2 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">
                  Borrower
                </th>
                <th className="text-right py-4 px-2 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">
                  Principal
                </th>
                <th className="text-right py-4 px-2 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">
                  Collateral
                </th>
                <th className="text-right py-4 px-2 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">
                  Position Age
                </th>
                <th className="text-right py-4 px-2 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {visiblePositions.map((position) => (
                <tr key={position.id} className="group hover:bg-muted/30 transition-colors">
                  <td className="py-4 px-2">
                    <Link
                      href={`/borrowers/${position.borrowerAddress}`}
                      className="font-mono text-xs text-primary hover:underline hover:text-primary/80 transition-colors"
                    >
                      {position.borrowerAddress.slice(0, 12)}...{position.borrowerAddress.slice(-8)}
                    </Link>
                  </td>
                  <td className="text-right py-4 px-2 font-serif font-bold text-foreground/80">
                    {formatCurrency(position.principal)}
                  </td>
                  <td className="text-right py-4 px-2 text-xs text-muted-foreground/70">
                    {formatCurrency(position.collateral)}
                  </td>
                  <td className="text-right py-4 px-2 text-[10px] font-medium text-muted-foreground/60 uppercase">
                    {new Date(position.openedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="text-right py-4 px-2">
                    <Badge
                      variant={position.isActive ? 'secondary' : 'outline'}
                      className={cn(
                        "px-2 py-0 text-[9px] uppercase tracking-tighter",
                        position.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                      )}
                    >
                      {position.isActive ? 'Active' : 'Settled'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {needsPagination && (
          <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between">
            <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/40">
              {showAll ? `Showing all ${totalCount} positions` : `${startIdx}\u2013${endIdx} of ${totalCount}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAll(s => !s)}
                className="text-[10px] font-sans font-bold uppercase tracking-widest text-primary hover:text-primary/70 transition-colors px-2 py-1"
              >
                {showAll ? 'Paginate' : 'Show all'}
              </button>
              {!showAll && (
                <>
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] font-sans font-bold text-muted-foreground/60 tabular-nums min-w-[3rem] text-center">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="p-1.5 rounded border border-border/50 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
