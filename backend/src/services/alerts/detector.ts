import { prisma } from '@/config/database';
import { getMarketAPR } from '@/services/morpho/queries';
import { ALERT_THRESHOLDS, MARKETS } from '@/config/constants';
import { logger } from '@/utils/logger';

export type AlertType =
  | 'HIGH_APR'
  | 'ELEVATED_APR'
  | 'LARGE_REIMBURSEMENT'
  | 'REIMBURSEMENT_SPIKE'
  | 'SYNC_FAILURE'
  | 'REIMBURSEMENT_FAILURE';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  marketId?: string | null;
  marketName?: string | null;
  borrowerAddress?: string | null;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  metadata?: Record<string, any>;
}

/**
 * Check for alerts and persist new ones to the database
 */
export async function checkAlerts(): Promise<Alert[]> {
  const detectedAlerts: Alert[] = [];

  try {
    // Check APR alerts for each market
    const aprAlerts = await checkAPRAlerts();
    detectedAlerts.push(...aprAlerts);

    // Check reimbursement alerts
    const reimbursementAlerts = await checkReimbursementAlerts();
    detectedAlerts.push(...reimbursementAlerts);

    // Check system health alerts
    const systemAlerts = await checkSystemAlerts();
    detectedAlerts.push(...systemAlerts);

    // Persist new alerts (with deduplication)
    await persistAlerts(detectedAlerts);

    // Auto-resolve alerts where conditions have cleared
    await resolveStaleAlerts(detectedAlerts);

  } catch (error) {
    logger.error('Failed to check alerts:', error);
    detectedAlerts.push({
      id: generateAlertId(),
      type: 'SYNC_FAILURE',
      severity: 'critical',
      message: 'Alert detection system failed',
      timestamp: new Date(),
      acknowledged: false,
      metadata: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
  }

  return detectedAlerts;
}

/**
 * Persist alerts to database with deduplication
 */
async function persistAlerts(alerts: Alert[]): Promise<void> {
  for (const alert of alerts) {
    try {
      // Check for existing unresolved alert of same type for same market
      const existingAlert = await prisma.alert.findFirst({
        where: {
          type: alert.type,
          marketId: alert.marketId || undefined,
          resolvedAt: null,
          createdAt: {
            // Only check alerts from last 24 hours
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      });

      if (existingAlert) {
        // Update the existing alert's metadata if needed
        await prisma.alert.update({
          where: { id: existingAlert.id },
          data: {
            message: alert.message,
            metadata: alert.metadata as any,
            updatedAt: new Date(),
          },
        });
        logger.debug(`Updated existing alert: ${existingAlert.id}`);
      } else {
        // Create new alert
        await prisma.alert.create({
          data: {
            type: alert.type,
            severity: alert.severity,
            message: alert.message,
            marketId: alert.marketId || null,
            marketName: getMarketName(alert.marketId),
            borrowerAddress: alert.borrowerAddress || null,
            metadata: alert.metadata as any,
          },
        });
        logger.info(`Created new alert: ${alert.type} - ${alert.message}`);
      }
    } catch (error) {
      logger.error(`Failed to persist alert: ${error}`);
    }
  }
}

/**
 * Resolve alerts where conditions have cleared
 */
async function resolveStaleAlerts(currentAlerts: Alert[]): Promise<void> {
  try {
    // Get current alert types by market
    const currentAlertKeys = new Set(
      currentAlerts.map(a => `${a.type}-${a.marketId || 'global'}`)
    );

    // Find unresolved alerts that are no longer detected
    const unresolvedAlerts = await prisma.alert.findMany({
      where: {
        resolvedAt: null,
        type: { in: ['HIGH_APR', 'ELEVATED_APR'] }, // Only auto-resolve APR alerts
      },
    });

    for (const alert of unresolvedAlerts) {
      const key = `${alert.type}-${alert.marketId || 'global'}`;
      if (!currentAlertKeys.has(key)) {
        // Condition has cleared - resolve the alert
        await prisma.alert.update({
          where: { id: alert.id },
          data: { resolvedAt: new Date() },
        });
        logger.info(`Auto-resolved alert: ${alert.id} (${alert.type})`);
      }
    }
  } catch (error) {
    logger.error(`Failed to resolve stale alerts: ${error}`);
  }
}

/**
 * Check for APR-related alerts
 */
async function checkAPRAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  for (const market of Object.values(MARKETS)) {
    try {
      const currentApr = await getMarketAPR(market.id);
      const ratio = currentApr / market.aprCapBps;

      if (ratio >= ALERT_THRESHOLDS.APR_CRITICAL_MULTIPLIER) {
        alerts.push({
          id: generateAlertId(),
          type: 'HIGH_APR',
          severity: 'critical',
          message: `${market.name} APR is ${(ratio * 100).toFixed(0)}% above cap (${(currentApr / 100).toFixed(2)}% vs ${(market.aprCapBps / 100).toFixed(2)}%)`,
          marketId: market.id,
          marketName: market.name,
          timestamp: new Date(),
          acknowledged: false,
          metadata: {
            currentApr,
            capApr: market.aprCapBps,
            ratio,
          },
        });
      } else if (ratio >= ALERT_THRESHOLDS.APR_WARNING_MULTIPLIER) {
        alerts.push({
          id: generateAlertId(),
          type: 'ELEVATED_APR',
          severity: 'warning',
          message: `${market.name} APR is ${(ratio * 100).toFixed(0)}% above cap (${(currentApr / 100).toFixed(2)}% vs ${(market.aprCapBps / 100).toFixed(2)}%)`,
          marketId: market.id,
          marketName: market.name,
          timestamp: new Date(),
          acknowledged: false,
          metadata: {
            currentApr,
            capApr: market.aprCapBps,
            ratio,
          },
        });
      }
    } catch (error) {
      logger.warn(`Failed to check APR for market ${market.name}:`, error);
    }
  }

  return alerts;
}

/**
 * Check for reimbursement-related alerts
 */
async function checkReimbursementAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Check today's reimbursements - need to convert to USD
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get reimbursements with market info for USD conversion
  const todayReimbursements = await prisma.reimbursement.findMany({
    where: {
      date: { gte: today, lt: tomorrow },
      status: 'processed',
    },
    include: {
      position: {
        include: { market: true },
      },
    },
  });

  // Token decimals for conversion
  const TOKEN_DECIMALS: Record<string, number> = {
    WETH: 18, wstETH: 18, WBTC: 8, USDC: 6, USDT: 6, WPOL: 18,
  };
  const TOKEN_PRICES: Record<string, number> = {
    WETH: 3200, wstETH: 3600, WBTC: 95000, USDC: 1, USDT: 1, WPOL: 0.45,
  };

  // Calculate USD total
  let todayTotalUsd = 0;
  for (const r of todayReimbursements) {
    const asset = r.position.market.loanAsset;
    const decimals = TOKEN_DECIMALS[asset] || 18;
    const price = TOKEN_PRICES[asset] || 1;
    const tokenAmount = parseFloat(r.amount.toString()) / Math.pow(10, decimals);
    todayTotalUsd += tokenAmount * price;
  }

  // Large reimbursement alert
  if (todayTotalUsd >= ALERT_THRESHOLDS.DAILY_REIMBURSEMENT_WARNING_USD) {
    alerts.push({
      id: generateAlertId(),
      type: 'LARGE_REIMBURSEMENT',
      severity: 'warning',
      message: `Large daily reimbursement: $${todayTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      timestamp: new Date(),
      acknowledged: false,
      metadata: { amount: Math.round(todayTotalUsd) },
    });
  }

  // Check for reimbursement spike (day-over-day increase)
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayReimbursements = await prisma.reimbursement.findMany({
    where: {
      date: { gte: yesterday, lt: today },
      status: 'processed',
    },
    include: {
      position: {
        include: { market: true },
      },
    },
  });

  let yesterdayTotalUsd = 0;
  for (const r of yesterdayReimbursements) {
    const asset = r.position.market.loanAsset;
    const decimals = TOKEN_DECIMALS[asset] || 18;
    const price = TOKEN_PRICES[asset] || 1;
    const tokenAmount = parseFloat(r.amount.toString()) / Math.pow(10, decimals);
    yesterdayTotalUsd += tokenAmount * price;
  }

  if (yesterdayTotalUsd > 0) {
    const spikeRatio = todayTotalUsd / yesterdayTotalUsd;
    if (spikeRatio >= (1 + ALERT_THRESHOLDS.DAILY_SPIKE_PERCENT / 100)) {
      alerts.push({
        id: generateAlertId(),
        type: 'REIMBURSEMENT_SPIKE',
        severity: 'info',
        message: `Reimbursement spike: +${((spikeRatio - 1) * 100).toFixed(0)}% ($${todayTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })} vs $${yesterdayTotalUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
        timestamp: new Date(),
        acknowledged: false,
        metadata: {
          todayAmount: Math.round(todayTotalUsd),
          yesterdayAmount: Math.round(yesterdayTotalUsd),
          spikeRatio,
        },
      });
    }
  }

  return alerts;
}

/**
 * Check for system health alerts
 */
async function checkSystemAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];

  // Check for recent sync failures (positions not updated in last 30 minutes)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const recentPositions = await prisma.position.findFirst({
    where: { updatedAt: { gte: thirtyMinutesAgo } },
  });

  if (!recentPositions) {
    // Check if we have any positions at all
    const totalPositions = await prisma.position.count();
    if (totalPositions > 0) {
      alerts.push({
        id: generateAlertId(),
        type: 'SYNC_FAILURE',
        severity: 'critical',
        message: 'Position sync may have failed - no recent updates',
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }

  // Check for failed reimbursements
  const recentFailedReimbursements = await prisma.reimbursement.count({
    where: {
      status: 'failed',
      createdAt: { gte: thirtyMinutesAgo },
    },
  });

  if (recentFailedReimbursements > 0) {
    alerts.push({
      id: generateAlertId(),
      type: 'REIMBURSEMENT_FAILURE',
      severity: 'critical',
      message: `${recentFailedReimbursements} reimbursement(s) failed recently`,
      timestamp: new Date(),
      acknowledged: false,
      metadata: { failedCount: recentFailedReimbursements },
    });
  }

  return alerts;
}

/**
 * Get stored alerts from database
 */
export async function getStoredAlerts(options: {
  limit?: number;
  offset?: number;
  acknowledged?: boolean;
  severity?: AlertSeverity;
  type?: AlertType;
  resolved?: boolean;
} = {}): Promise<Alert[]> {
  const where: any = {};

  if (options.acknowledged !== undefined) {
    where.acknowledged = options.acknowledged;
  }

  if (options.severity) {
    where.severity = options.severity;
  }

  if (options.type) {
    where.type = options.type;
  }

  if (options.resolved !== undefined) {
    where.resolvedAt = options.resolved ? { not: null } : null;
  }

  const alerts = await prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options.limit || 50,
    skip: options.offset || 0,
  });

  return alerts
    .map(mapDbAlertToAlert)
    .sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
      const diff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (diff !== 0) return diff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
}

/**
 * Get alert counts by severity
 */
export async function getAlertCounts(): Promise<{
  total: number;
  critical: number;
  warning: number;
  info: number;
  unacknowledged: number;
}> {
  const [total, critical, warning, info, unacknowledged] = await Promise.all([
    prisma.alert.count({ where: { resolvedAt: null } }),
    prisma.alert.count({ where: { severity: 'critical', resolvedAt: null } }),
    prisma.alert.count({ where: { severity: 'warning', resolvedAt: null } }),
    prisma.alert.count({ where: { severity: 'info', resolvedAt: null } }),
    prisma.alert.count({ where: { acknowledged: false, resolvedAt: null } }),
  ]);

  return { total, critical, warning, info, unacknowledged };
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, acknowledgedBy?: string): Promise<Alert | null> {
  try {
    const updated = await prisma.alert.update({
      where: { id: alertId },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: acknowledgedBy || 'system',
      },
    });
    return mapDbAlertToAlert(updated);
  } catch (error) {
    logger.error(`Failed to acknowledge alert ${alertId}:`, error);
    return null;
  }
}

/**
 * Acknowledge multiple alerts
 */
export async function acknowledgeAlerts(alertIds: string[], acknowledgedBy?: string): Promise<number> {
  const result = await prisma.alert.updateMany({
    where: { id: { in: alertIds } },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
      acknowledgedBy: acknowledgedBy || 'system',
    },
  });
  return result.count;
}

/**
 * Get alert statistics over time
 */
export async function getAlertStats(days: number = 7): Promise<Array<{
  date: string;
  critical: number;
  warning: number;
  info: number;
}>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const alerts = await prisma.alert.findMany({
    where: { createdAt: { gte: startDate } },
    select: { createdAt: true, severity: true },
  });

  // Group by date
  const byDate = new Map<string, { critical: number; warning: number; info: number }>();

  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];
    byDate.set(dateStr, { critical: 0, warning: 0, info: 0 });
  }

  for (const alert of alerts) {
    const dateStr = alert.createdAt.toISOString().split('T')[0];
    const entry = byDate.get(dateStr);
    if (entry) {
      entry[alert.severity as AlertSeverity]++;
    }
  }

  return Array.from(byDate.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));
}

/**
 * Map database alert to Alert interface
 */
function mapDbAlertToAlert(dbAlert: any): Alert {
  return {
    id: dbAlert.id,
    type: dbAlert.type as AlertType,
    severity: dbAlert.severity as AlertSeverity,
    message: dbAlert.message,
    marketId: dbAlert.marketId,
    marketName: dbAlert.marketName,
    borrowerAddress: dbAlert.borrowerAddress,
    timestamp: dbAlert.createdAt,
    acknowledged: dbAlert.acknowledged,
    acknowledgedAt: dbAlert.acknowledgedAt,
    resolvedAt: dbAlert.resolvedAt,
    metadata: dbAlert.metadata as Record<string, any> | undefined,
  };
}

/**
 * Get market name from ID
 */
function getMarketName(marketId?: string | null): string | null {
  if (!marketId) return null;
  const market = Object.values(MARKETS).find(m => m.id === marketId);
  return market?.name || null;
}

/**
 * Generate unique alert ID
 */
function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
