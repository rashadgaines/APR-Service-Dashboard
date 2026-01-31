'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiClient } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  DollarSign,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Download,
  Filter,
  RefreshCw,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Reimbursement {
  id: string;
  positionId: string;
  borrowerAddress: string;
  marketName: string;
  date: string;
  amount: string;
  txHash: string | null;
  status: string;
}

export default function ReimbursementsPage() {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filters, setFilters] = useState<{
    status?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const pageSize = 25;

  const fetchReimbursements = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getReimbursements({
        limit: pageSize,
        ...filters,
      }) as { reimbursements: Reimbursement[] };
      const items = data.reimbursements || [];
      setReimbursements(items);
      setHasMore(items.length === pageSize);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch reimbursements');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchReimbursements();
  }, [fetchReimbursements]);

  const exportToCSV = () => {
    if (reimbursements.length === 0) return;

    const headers = ['Date', 'Borrower', 'Market', 'Amount', 'Status', 'Transaction Hash'];
    const rows = reimbursements.map(r => [
      new Date(r.date).toISOString().split('T')[0],
      r.borrowerAddress,
      r.marketName,
      r.amount,
      r.status,
      r.txHash || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `reimbursements-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Calculate summary stats
  const totalAmount = reimbursements.reduce(
    (sum, r) => sum + parseFloat(r.amount || '0'),
    0
  );
  const processedCount = reimbursements.filter(r => r.status === 'processed').length;
  const failedCount = reimbursements.filter(r => r.status === 'failed').length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-1 bg-gradient-to-b from-primary to-primary/50 rounded-full" />
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Reimbursements
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={exportToCSV}
                disabled={reimbursements.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                title="Export to CSV"
              >
                <Download className="h-4 w-4" />
                Export
              </button>
              <button
                onClick={fetchReimbursements}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <p className="text-muted-foreground ml-[19px]">
            Interest excess reimbursement history
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total Amount</p>
              <p className="text-2xl font-bold text-primary">
                {formatCurrency(totalAmount.toString())}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-2xl font-bold">{reimbursements.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Processed</p>
              <p className="text-2xl font-bold text-emerald-500">{processedCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold text-destructive">{failedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>

              {/* Status Filter */}
              <select
                value={filters.status || ''}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value || undefined })
                }
                className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
              >
                <option value="">All Status</option>
                <option value="processed">Processed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>

              {/* Date Range */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, startDate: e.target.value || undefined })
                  }
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  placeholder="Start date"
                />
                <span className="text-muted-foreground">to</span>
                <input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value || undefined })
                  }
                  className="px-3 py-1.5 rounded-lg border border-border bg-background text-sm"
                  placeholder="End date"
                />
              </div>

              {(filters.status || filters.startDate || filters.endDate) && (
                <button
                  onClick={() => setFilters({})}
                  className="text-sm text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reimbursements Table */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <p className="text-destructive font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        ) : reimbursements.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Reimbursements</h3>
              <p className="text-muted-foreground">
                {filters.status || filters.startDate || filters.endDate
                  ? 'No reimbursements match the current filters.'
                  : 'No reimbursements have been processed yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Borrower
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">
                        Market
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Amount
                      </th>
                      <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">
                        Transaction
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reimbursements.map((reimbursement) => (
                      <tr
                        key={reimbursement.id}
                        className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                      >
                        <td className="py-3 px-4 text-sm">
                          {new Date(reimbursement.date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/borrowers/${reimbursement.borrowerAddress}`}
                            className="font-mono text-sm text-primary hover:underline"
                          >
                            {reimbursement.borrowerAddress.slice(0, 8)}...
                            {reimbursement.borrowerAddress.slice(-6)}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {reimbursement.marketName}
                        </td>
                        <td className="text-right py-3 px-4 font-medium">
                          {formatCurrency(reimbursement.amount)}
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge
                            variant={
                              reimbursement.status === 'processed'
                                ? 'secondary'
                                : reimbursement.status === 'failed'
                                ? 'destructive'
                                : 'outline'
                            }
                            className={
                              reimbursement.status === 'processed'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : ''
                            }
                          >
                            {reimbursement.status}
                          </Badge>
                        </td>
                        <td className="text-right py-3 px-4">
                          {reimbursement.txHash ? (
                            <a
                              href={`https://polygonscan.com/tx/${reimbursement.txHash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-sm text-primary hover:underline inline-flex items-center gap-1"
                            >
                              {reimbursement.txHash.slice(0, 8)}...
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Showing {reimbursements.length} reimbursements
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm">Page {page + 1}</span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!hasMore}
                    className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
