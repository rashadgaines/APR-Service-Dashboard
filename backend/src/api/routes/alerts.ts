import { Router, Request, Response } from 'express';
import {
  checkAlerts,
  getStoredAlerts,
  getAlertCounts,
  getAlertStats,
  acknowledgeAlert,
  acknowledgeAlerts,
  type AlertSeverity,
  type AlertType,
} from '@/services/alerts/detector';
import { asyncHandler } from '@/api/middleware/error';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const alerts = await checkAlerts();

    // Filter by severity if requested
    const severity = req.query.severity as string;
    const filteredAlerts = severity
      ? alerts.filter(alert => alert.severity === severity)
      : alerts;

    // Sort by severity (critical first) and timestamp
    const sortedAlerts = filteredAlerts.sort((a, b) => {
      const severityOrder: Record<string, number> = { critical: 3, warning: 2, info: 1 };
      const severityDiff = (severityOrder[b.severity] || 0) - (severityOrder[a.severity] || 0);
      if (severityDiff !== 0) return severityDiff;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });

    res.json({
      alerts: sortedAlerts,
      total: sortedAlerts.length,
      breakdown: {
        critical: sortedAlerts.filter(a => a.severity === 'critical').length,
        warning: sortedAlerts.filter(a => a.severity === 'warning').length,
        info: sortedAlerts.filter(a => a.severity === 'info').length,
      },
    });
  } catch (error) {
    console.error('Failed to fetch alerts:', error);
    res.json({
      alerts: [],
      total: 0,
      breakdown: { critical: 0, warning: 0, info: 0 },
      note: 'Alert system temporarily unavailable'
    });
  }
}));

/**
 * GET /api/alerts/history
 * Returns historical alerts from database
 */
router.get('/history', asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const acknowledged = req.query.acknowledged === undefined
    ? undefined
    : req.query.acknowledged === 'true';
  const severity = req.query.severity as AlertSeverity | undefined;
  const type = req.query.type as AlertType | undefined;
  const resolved = req.query.resolved === undefined
    ? undefined
    : req.query.resolved === 'true';

  const alerts = await getStoredAlerts({
    limit,
    offset,
    acknowledged,
    severity,
    type,
    resolved,
  });

  const counts = await getAlertCounts();

  res.json({
    alerts,
    total: alerts.length,
    counts,
  });
}));

/**
 * GET /api/alerts/counts
 * Returns alert counts by severity
 */
router.get('/counts', asyncHandler(async (req: Request, res: Response) => {
  const counts = await getAlertCounts();
  res.json(counts);
}));

/**
 * GET /api/alerts/stats
 * Returns alert statistics over time
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 7, 30);
  const stats = await getAlertStats(days);

  res.json({
    days,
    stats,
  });
}));

/**
 * POST /api/alerts/:id/acknowledge
 * Acknowledge a single alert
 */
router.post('/:id/acknowledge', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { acknowledgedBy } = req.body;

  const alert = await acknowledgeAlert(id, acknowledgedBy);

  if (!alert) {
    res.status(404).json({
      error: 'Alert not found',
      message: `No alert found with ID: ${id}`,
    });
    return;
  }

  res.json({
    success: true,
    alert,
  });
}));

/**
 * POST /api/alerts/acknowledge-batch
 * Acknowledge multiple alerts
 */
router.post('/acknowledge-batch', asyncHandler(async (req: Request, res: Response) => {
  const { alertIds, acknowledgedBy } = req.body;

  if (!Array.isArray(alertIds) || alertIds.length === 0) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'alertIds must be a non-empty array',
    });
    return;
  }

  const count = await acknowledgeAlerts(alertIds, acknowledgedBy);

  res.json({
    success: true,
    acknowledgedCount: count,
  });
}));

export default router;
