'use client';

import { useOverviewMetrics } from '@/hooks/useMetrics';
import { useMemo, memo } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Users, AlertTriangle, DollarSign, Wallet, CheckCircle } from 'lucide-react';
import { formatCurrency, formatNumber, cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface CardData {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  highlight?: boolean;
  badge?: React.ReactNode;
}

// Memoized individual card component
const MetricCard = memo(function MetricCard({
  card,
  index,
}: {
  card: CardData;
  index: number;
}) {
  const Icon = card.icon;
  return (
    <Card
      className={cn(
        'group relative border border-border/50 py-1 sm:py-2 transition-all hover:bg-muted/30',
        card.highlight && 'bg-primary/5 border-primary/20 ring-1 ring-primary/10',
        index === 0 && 'col-span-2 sm:col-span-2 lg:col-span-1'
      )}
    >
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between mb-2 sm:mb-4">
          <p className="text-[9px] sm:text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/80">
            {card.title}
          </p>
          <div className={cn('p-1.5 sm:p-2 rounded-full ring-1 ring-border/50', card.iconBg)}>
            <Icon className={cn('h-3 w-3 sm:h-3.5 sm:w-3.5', card.iconColor)} />
          </div>
        </div>
        <div className="flex flex-wrap items-baseline gap-1 sm:gap-2 mb-1 sm:mb-2">
          <span className={cn(
            'text-xl sm:text-2xl lg:text-3xl font-serif font-bold tracking-tight text-foreground/90',
            card.highlight && 'text-primary'
          )}>
            {card.value}
          </span>
          <span className="hidden sm:inline">{card.badge}</span>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground/70 font-medium truncate">
          {card.subtitle}
        </p>
      </CardContent>
      {card.highlight && (
        <div className="absolute top-0 right-0 h-16 w-16 -mr-8 -mt-8 bg-primary/5 rounded-full blur-2xl" />
      )}
    </Card>
  );
});

// Loading skeleton component
const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i} className={cn(
          'relative overflow-hidden',
          i === 0 && 'col-span-2 sm:col-span-2 lg:col-span-1'
        )}>
          <CardContent className="p-4 sm:p-6">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-8 bg-muted rounded w-3/4"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

export function OverviewCards() {
  const { data, loading, error } = useOverviewMetrics();

  // Memoize cards array computation
  const cards = useMemo(() => {
    if (!data) return [];

    const safePercent = (num: number, total: number) => {
      if (total === 0) return '0.0';
      return ((num / total) * 100).toFixed(1);
    };

    return [
      {
        title: 'Total Value Locked',
        value: formatCurrency(data.totalValueLocked),
        subtitle: 'Across all markets',
        icon: Wallet,
        iconBg: 'bg-purple-500/10',
        iconColor: 'text-purple-500',
        highlight: true,
      },
      {
        title: 'Active Borrowers',
        value: formatNumber(data.activeBorrowers),
        subtitle: `${formatNumber(data.totalBorrowers)} total accounts`,
        icon: Users,
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-500',
      },
      {
        title: 'Under APR Cap',
        value: formatNumber(data.borrowersUnderCap),
        subtitle: `${safePercent(data.borrowersUnderCap, data.activeBorrowers)}% compliant`,
        icon: CheckCircle,
        iconBg: 'bg-emerald-500/10',
        iconColor: 'text-emerald-500',
      },
      {
        title: 'Above APR Cap',
        value: formatNumber(data.borrowersAboveCap),
        subtitle: `${safePercent(data.borrowersAboveCap, data.activeBorrowers)}% need reimbursement`,
        icon: AlertTriangle,
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        badge: data.borrowersAboveCap > 0 ? (
          <Badge variant="destructive" className="ml-2 animate-pulse">
            Action Required
          </Badge>
        ) : (
          <Badge variant="secondary" className="ml-2 bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            All Clear
          </Badge>
        ),
      },
      {
        title: "Today's Reimbursements",
        value: formatCurrency(data.todayReimbursements),
        subtitle: `${formatCurrency(data.totalReimbursements)} all time`,
        icon: DollarSign,
        iconBg: 'bg-green-500/10',
        iconColor: 'text-green-500',
      },
    ] as CardData[];
  }, [data]);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <p className="text-destructive font-medium">Unable to load metrics. Please try again later.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-6">
      {cards.map((card, index) => (
        <MetricCard key={card.title} card={card} index={index} />
      ))}
    </div>
  );
}
