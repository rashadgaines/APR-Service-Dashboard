'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, AlertCircle, Info, ExternalLink } from 'lucide-react';
import type { AlertsResponse, Alert } from '@/types';

// Memoized alert item component
const AlertItem = memo(function AlertItem({ alert }: { alert: Alert }) {
  const icon = useMemo(() => {
    switch (alert.severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <Info className="w-4 h-4 text-gray-500" />;
    }
  }, [alert.severity]);

  const badge = useMemo(() => {
    switch (alert.severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Warning</Badge>;
      case 'info':
        return <Badge variant="outline">Info</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  }, [alert.severity]);

  const timeString = useMemo(() => {
    return new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [alert.timestamp]);

  return (
    <div className="py-4 border-b border-border/30 last:border-b-0 group">
      <div className="flex items-start space-x-4">
        <div className="mt-1">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            {badge}
            <span className="text-[10px] font-sans font-medium text-muted-foreground/60 uppercase tracking-wider">
              {timeString}
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed font-medium">
            {alert.message}
          </p>
        </div>
      </div>
    </div>
  );
});

// Loading skeleton
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

export function RecentAlerts() {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAlerts<AlertsResponse>();
      setAlerts(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    // Refresh alerts every 30 seconds
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  // Memoize the recent alerts slice
  const recentAlerts = useMemo(() => {
    return alerts?.alerts.slice(0, 3) || [];
  }, [alerts?.alerts]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-destructive text-sm">Failed to load alerts: {error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pt-6 px-6 pb-4">
        <CardTitle className="font-serif text-xl">Recent Alerts</CardTitle>
        {alerts && alerts.total > 0 && (
          <div className="flex space-x-1.5">
            {alerts.breakdown.critical > 0 && (
              <Badge variant="destructive" className="px-2 py-0">
                {alerts.breakdown.critical}
              </Badge>
            )}
            {alerts.breakdown.warning > 0 && (
              <Badge variant="secondary" className="px-2 py-0 bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                {alerts.breakdown.warning}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent className="px-6 pb-6">
        {recentAlerts.length === 0 ? (
          <div className="text-center py-8">
            <Info className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-xs italic">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-0">
            {recentAlerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}

            {alerts && alerts.total > 3 && (
              <div className="pt-4">
                <Link href="/alerts" className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline flex items-center space-x-1 transition-all">
                  <span>Manage all alerts</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
