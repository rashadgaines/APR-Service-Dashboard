'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiClient } from '@/lib/api';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import {
  ArrowLeft,
  User,
  Wallet,
  Clock,
  DollarSign,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
} from 'lucide-react';

interface Position {
  id: string;
  marketId: string;
  marketName: string;
  principal: string;
  collateral: string;
  isActive: boolean;
  openedAt: string;
  closedAt?: string;
}

interface Reimbursement {
  id: string;
  date: string;
  amount: string;
  txHash: string | null;
  status: string;
  marketName: string;
}

interface BorrowerDetail {
  address: string;
  positions: Position[];
  reimbursements: Reimbursement[];
  totalBorrowed: string;
  totalReimbursed: string;
  pendingReimbursement: string;
  activePositionCount: number;
}

export default function BorrowerDetailPage() {
  const params = useParams();
  const address = params.address as string;
  const [borrower, setBorrower] = useState<BorrowerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchBorrower = async () => {
      try {
        setLoading(true);
        const data = await apiClient.getBorrower<any>(address);
        if (data.borrower) {
          // Flatten reimbursements from all positions
          const allReimbursements = data.positions.flatMap((pos: any) =>
            pos.recentReimbursements.map((r: any) => ({
              ...r,
              marketName: pos.marketName
            }))
          ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

          setBorrower({
            ...data.borrower,
            positions: data.positions,
            reimbursements: allReimbursements,
            activePositionCount: data.borrower.activePositions
          });
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch borrower');
      } finally {
        setLoading(false);
      }
    };

    if (address) {
      fetchBorrower();
    }
  }, [address]);

  const copyAddress = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  if (error || !borrower) {
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
                {error || 'Borrower data unavailable'}
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

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
          Back
        </Link>

        {/* Borrower Header */}
        <div className="mb-16">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 rounded-full bg-primary/5 border border-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="h-7 w-7 text-primary/60" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-serif font-bold tracking-tight text-foreground/90">
                    {address.slice(0, 10)}...{address.slice(-8)}
                  </h1>
                  <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-full border border-border/50">
                    <button
                      onClick={copyAddress}
                      className="p-1.5 rounded-full hover:bg-background transition-all"
                      title="Copy address"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground/60" />
                      )}
                    </button>
                    <a
                      href={`https://polygonscan.com/address/${address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-full hover:bg-background transition-all"
                      title="View on PolygonScan"
                    >
                      <ExternalLink className="h-3 w-3 text-muted-foreground/60" />
                    </a>
                  </div>
                </div>
                <p className="text-sm font-medium text-muted-foreground/80 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {borrower.activePositionCount} active lending position{borrower.activePositionCount !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 p-6 rounded-2xl bg-primary/[0.02] border border-primary/10">
              <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60">Total Yield Reimbursed</p>
              <p className="text-2xl font-serif font-bold text-emerald-600">
                {formatCurrency(borrower.totalReimbursed)}
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <Wallet className="h-3 w-3" />
                Active Debt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-serif font-bold text-foreground/80">
                {formatCurrency(borrower.totalBorrowed)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <DollarSign className="h-3 w-3" />
                All-time Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-serif font-bold text-emerald-600">
                {formatCurrency(borrower.totalReimbursed)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-amber-500/[0.02] border-amber-500/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-amber-600/60 flex items-center gap-2">
                <Clock className="h-3 w-3" />
                Next Batch
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-serif font-bold text-amber-600">
                {formatCurrency(borrower.pendingReimbursement)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-[10px] font-sans font-bold uppercase tracking-[0.2em] text-muted-foreground/60 flex items-center gap-2">
                <TrendingUp className="h-3 w-3" />
                Positions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-serif font-bold text-foreground/80">
                  {borrower.positions.length}
                </p>
                <p className="text-xs font-medium text-muted-foreground/60">
                  ({borrower.activePositionCount} active)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Positions Section */}
        <div className="grid grid-cols-1 gap-12">
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold text-foreground/90 flex items-center gap-3">
                <div className="w-1 h-6 bg-primary/20" />
                Active Market Positions
              </h2>
              <Badge variant="secondary" className="px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-widest">
                {borrower.positions.length} Records
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {borrower.positions.length === 0 ? (
                <Card className="col-span-full border-border/50 border-dashed py-12 text-center bg-muted/5">
                  <p className="text-muted-foreground text-sm italic">No records found</p>
                </Card>
              ) : (
                borrower.positions.map((position) => (
                  <Card key={position.id} className="group border border-border/50 hover:bg-muted/30 transition-all">
                    <CardContent className="p-8">
                      <div className="flex justify-between items-start mb-6">
                        <div>
                          <Link
                            href={`/markets/${position.marketId}`}
                            className="text-xl font-serif font-bold text-foreground/90 hover:text-primary transition-colors block"
                          >
                            {position.marketName}
                          </Link>
                          <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50 mt-1">
                            Market ID: {position.marketId.slice(0, 12)}...
                          </p>
                        </div>
                        <Badge
                          variant={position.isActive ? 'secondary' : 'outline'}
                          className={cn(
                            "px-3 py-0.5 text-[9px] uppercase tracking-tighter",
                            position.isActive ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                          )}
                        >
                          {position.isActive ? 'Active' : 'Closed'}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-8 mb-6">
                        <div className="space-y-1">
                          <p className="text-[9px] font-sans font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Principal</p>
                          <p className="text-lg font-serif font-bold text-foreground/80">{formatCurrency(position.principal)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[9px] font-sans font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">Collateral</p>
                          <p className="text-lg font-serif font-bold text-foreground/80">{formatCurrency(position.collateral)}</p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border/20 flex justify-between items-center">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/60 uppercase">
                          <Clock className="h-3 w-3" />
                          Opened {new Date(position.openedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {!position.isActive && (
                          <div className="text-[10px] font-medium text-muted-foreground/40 uppercase">
                            Finalized
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>

          {/* Reimbursement History */}
          <section>
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-serif font-bold text-foreground/90 flex items-center gap-3">
                <div className="w-1 h-6 bg-emerald-500/20" />
                Yield Reimbursement History
              </h2>
              <Badge variant="secondary" className="px-3 py-1 font-sans text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                {borrower.reimbursements.length} Payments
              </Badge>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border/30">
                        <th className="text-left py-5 px-8 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">Date</th>
                        <th className="text-left py-5 px-8 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">Market Source</th>
                        <th className="text-right py-5 px-8 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">Amount Paid</th>
                        <th className="text-center py-5 px-8 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">Audit Status</th>
                        <th className="text-right py-5 px-8 text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/50">Ledger Record</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {borrower.reimbursements.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-12 text-center text-muted-foreground text-sm italic">No reimbursement history available</td>
                        </tr>
                      ) : (
                        borrower.reimbursements.map((reimbursement) => (
                          <tr key={reimbursement.id} className="group hover:bg-muted/30 transition-colors">
                            <td className="py-5 px-8 text-xs font-medium text-muted-foreground/80">
                              {new Date(reimbursement.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td className="py-5 px-8 text-sm font-serif font-bold text-foreground/70">
                              {reimbursement.marketName}
                            </td>
                            <td className="text-right py-5 px-8 text-sm font-serif font-bold text-emerald-600">
                              {formatCurrency(reimbursement.amount)}
                            </td>
                            <td className="text-center py-5 px-8">
                              <Badge
                                variant={reimbursement.status === 'processed' ? 'secondary' : 'outline'}
                                className={cn(
                                  "px-2 py-0 text-[9px] uppercase tracking-tighter",
                                  reimbursement.status === 'processed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : ''
                                )}
                              >
                                {reimbursement.status}
                              </Badge>
                            </td>
                            <td className="text-right py-5 px-8">
                              {reimbursement.txHash ? (
                                <a
                                  href={`https://polygonscan.com/tx/${reimbursement.txHash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-[11px] text-primary hover:underline hover:text-primary/80 flex items-center justify-end gap-1.5 opacity-60 hover:opacity-100 transition-all"
                                >
                                  {reimbursement.txHash.slice(0, 10)}...
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              ) : (
                                <span className="text-muted-foreground/30 text-xs">-</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>
    </div>
  );
}
