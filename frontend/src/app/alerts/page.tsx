'use client';

import { useState, useEffect, useCallback } from 'react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiClient } from '@/lib/api';
import {
  AlertTriangle,
  AlertCircle,
  Info,
  Loader2,
  Check,
  CheckCircle2,
  Bell,
  Filter,
  RefreshCw,
} from 'lucide-react';

interface Alert {
  id: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  marketId?: string;
  marketName?: string;
  timestamp: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  resolvedAt?: string;
  metadata?: Record<string, any>;
}

interface AlertCounts {
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [counts, setCounts] = useState<AlertCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledging, setAcknowledging] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<{
    severity?: string;
    acknowledged?: boolean;
    resolved?: boolean;
  }>({});

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAlertHistory({
        limit: 100,
        ...filter,
      }) as { alerts: Alert[]; counts: AlertCounts };
      setAlerts(data.alerts || []);
      setCounts(data.counts || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    setAcknowledging(prev => new Set(prev).add(alertId));
    try {
      await apiClient.acknowledgeAlert(alertId);
      // Refresh alerts
      await fetchAlerts();
    } catch {
      // Error handled silently - UI state will refresh on next fetch
    } finally {
      setAcknowledging(prev => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  };

  const handleAcknowledgeAll = async () => {
    const unacknowledgedIds = alerts
      .filter(a => !a.acknowledged)
      .map(a => a.id);

    if (unacknowledgedIds.length === 0) return;

    setAcknowledging(new Set(unacknowledgedIds));
    try {
      await apiClient.acknowledgeAlerts(unacknowledgedIds);
      await fetchAlerts();
    } catch {
      // Error handled silently - UI state will refresh on next fetch
    } finally {
      setAcknowledging(new Set());
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case 'info':
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Warning</Badge>;
      case 'info':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20">Info</Badge>;
      default:
        return <Badge variant="secondary">{severity}</Badge>;
    }
  };

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
                Alerts
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchAlerts}
                disabled={loading}
                className="p-2 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
                title="Refresh"
              >
                <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          <p className="text-muted-foreground ml-[19px]">
            System alerts and notifications
          </p>
        </div>

        {/* Alert Counts */}
        {counts && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Card
              className={`cursor-pointer transition-all ${
                !filter.severity ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setFilter({ ...filter, severity: undefined })}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{counts.total}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                filter.severity === 'critical' ? 'ring-2 ring-red-500' : ''
              }`}
              onClick={() => setFilter({ ...filter, severity: 'critical' })}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-500">{counts.critical}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                filter.severity === 'warning' ? 'ring-2 ring-amber-500' : ''
              }`}
              onClick={() => setFilter({ ...filter, severity: 'warning' })}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Warning</p>
                <p className="text-2xl font-bold text-amber-500">{counts.warning}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                filter.severity === 'info' ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setFilter({ ...filter, severity: 'info' })}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Info</p>
                <p className="text-2xl font-bold text-blue-500">{counts.info}</p>
              </CardContent>
            </Card>
            <Card
              className={`cursor-pointer transition-all ${
                filter.acknowledged === false ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => setFilter({ ...filter, acknowledged: filter.acknowledged === false ? undefined : false })}
            >
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">Unacknowledged</p>
                <p className="text-2xl font-bold">{counts.unacknowledged}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {filter.severity && `Severity: ${filter.severity}`}
              {filter.acknowledged === false && ' | Unacknowledged only'}
            </span>
            {(filter.severity || filter.acknowledged !== undefined) && (
              <button
                onClick={() => setFilter({})}
                className="text-sm text-primary hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
          {alerts.some(a => !a.acknowledged) && (
            <button
              onClick={handleAcknowledgeAll}
              disabled={acknowledging.size > 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              Acknowledge All
            </button>
          )}
        </div>

        {/* Alert List */}
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
        ) : alerts.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Alerts</h3>
              <p className="text-muted-foreground">
                {filter.severity || filter.acknowledged !== undefined
                  ? 'No alerts match the current filters.'
                  : 'All systems operating normally.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <Card
                key={alert.id}
                className={`transition-all ${
                  alert.acknowledged ? 'opacity-60' : ''
                } ${alert.resolvedAt ? 'border-emerald-500/30' : ''}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="mt-1">
                        {getSeverityIcon(alert.severity)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {getSeverityBadge(alert.severity)}
                          <Badge variant="outline" className="text-xs">
                            {alert.type.replace(/_/g, ' ')}
                          </Badge>
                          {alert.marketName && (
                            <Badge variant="secondary" className="text-xs">
                              {alert.marketName}
                            </Badge>
                          )}
                          {alert.resolvedAt && (
                            <Badge className="bg-emerald-500/10 text-emerald-500 text-xs">
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-foreground">
                          {alert.message}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleString()}
                          {alert.acknowledgedAt && (
                            <span className="ml-2">
                              | Acknowledged {new Date(alert.acknowledgedAt).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {!alert.acknowledged && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        disabled={acknowledging.has(alert.id)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                      >
                        {acknowledging.has(alert.id) ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        <span className="text-sm">Acknowledge</span>
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
