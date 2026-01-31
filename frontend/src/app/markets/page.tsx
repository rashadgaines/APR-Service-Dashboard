'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, Users, AlertTriangle, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Market {
  id: string;
  marketId: string;
  name: string;
  collateralAsset: string;
  loanAsset: string;
  lltv: string;
  aprCap: string;
  borrowerCount: number;
  totalBorrowed: string;
  aboveCapCount: number;
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getMarkets<{ markets: Market[] }>();
        setMarkets(data.markets || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch markets');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

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

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      <Header />
      <main className="container mx-auto px-6 py-12 lg:px-8 max-w-7xl">
        {/* Header */}
        <div className="mb-16">
          <div className="flex items-start gap-4 mb-3">
            <div className="h-12 w-[1px] bg-primary/30 mt-1" />
            <div>
              <h1 className="text-4xl font-serif font-bold tracking-tight text-foreground">
                Markets
              </h1>
              <p className="text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                Morpho lending pools with automated APR cap enforcement.
                Monitoring and rebalancing liquidity to maintain target rates.
              </p>
            </div>
          </div>
        </div>

        {error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-destructive font-medium">
                  Unable to load markets. Please try again later.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : markets.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Markets Found</h3>
              <p className="text-muted-foreground">
                Markets will appear here once positions are synced from Morpho.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {markets.map((market) => (
              <Card
                key={market.id || market.marketId}
                className="group border border-border/50 hover:bg-muted/30 transition-all py-2"
              >
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                    {/* Market Info */}
                    <div className="flex flex-col md:flex-row md:items-center gap-12 flex-1">
                      {/* Market Name & Assets */}
                      <div className="min-w-[200px]">
                        <h3 className="text-2xl font-serif font-bold text-foreground/90 mb-1 group-hover:text-primary transition-colors">
                          {market.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">
                            {market.collateralAsset}
                          </span>
                          <ArrowRight className="h-2.5 w-2.5 text-muted-foreground/40" />
                          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">
                            {market.loanAsset}
                          </span>
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-8 flex-1">
                        {/* LLTV */}
                        <div className="space-y-1">
                          <p className="text-[9px] font-sans font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                            LLTV
                          </p>
                          <p className="text-lg font-serif font-bold text-foreground/80">
                            {(parseFloat(market.lltv) * 100).toFixed(1)}%
                          </p>
                        </div>

                        {/* APR Cap */}
                        <div className="space-y-1">
                          <p className="text-[9px] font-sans font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                            APR Cap
                          </p>
                          <p className="text-lg font-serif font-bold text-primary">
                            {parseFloat(market.aprCap).toFixed(0)}%
                          </p>
                        </div>

                        {/* Borrowers */}
                        <div className="space-y-1">
                          <p className="text-[9px] font-sans font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                            Borrowers
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-serif font-bold text-foreground/80">
                              {formatNumber(market.borrowerCount)}
                            </span>
                          </div>
                        </div>

                        {/* TVL */}
                        <div className="space-y-1">
                          <p className="text-[9px] font-sans font-bold text-muted-foreground/50 uppercase tracking-[0.2em]">
                            Borrowed
                          </p>
                          <p className="text-lg font-serif font-bold text-foreground/80">
                            {formatCurrency(market.totalBorrowed)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center justify-between md:justify-end gap-6 pt-4 md:pt-0 border-t md:border-t-0 border-border/30">
                      {market.aboveCapCount > 0 ? (
                        <Badge variant="destructive" className="px-3 py-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3 mr-1.5" />
                          {market.aboveCapCount} Issue{market.aboveCapCount > 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="px-3 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        >
                          Compliant
                        </Badge>
                      )}

                      <Link
                        href={`/markets/${market.id}`}
                        className="flex items-center justify-center w-10 h-10 rounded-full border border-border/50 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all group/btn"
                      >
                        <ArrowRight className="h-4 w-4 transform group-hover/btn:translate-x-0.5 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {markets.length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Markets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{markets.length}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Borrowers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {formatNumber(
                    markets.reduce((sum, m) => sum + m.borrowerCount, 0)
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Markets Above Cap
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {markets.filter((m) => m.aboveCapCount > 0).length}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
