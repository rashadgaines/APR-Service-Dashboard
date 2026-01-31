import { Router, Request, Response } from 'express';
import { getJobStatuses, runJob } from '@/services/reimbursement/scheduler';
import { asyncHandler, AppError } from '@/api/middleware/error';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/jobs
 * Returns status of all scheduled jobs
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const jobStatuses = getJobStatuses();

  const jobs = jobStatuses.map(job => ({
    name: job.name,
    status: job.isRunning ? 'running' : 'idle',
    lastRun: job.lastRun?.toISOString() || null,
    error: job.error,
    nextRun: getNextRunTime(job.name),
  }));

  res.json({
    jobs,
    total: jobs.length,
    running: jobs.filter(j => j.status === 'running').length,
  });
}));

/**
 * POST /api/jobs/:jobName/run
 * Manually trigger a specific job
 */
router.post('/:jobName/run', asyncHandler(async (req: Request, res: Response) => {
  const { jobName } = req.params;
  const validJobs = ['position-sync', 'daily-accrual', 'daily-reimbursement'];

  if (!validJobs.includes(jobName)) {
    throw new AppError(`Invalid job name. Valid jobs: ${validJobs.join(', ')}`, 400);
  }

  const result = await runJob(jobName);

  if (!result.success) {
    throw new AppError(result.error || 'Job execution failed', 500);
  }

  res.json({
    success: true,
    message: `Job ${jobName} executed successfully`,
    jobName,
    executedAt: new Date().toISOString(),
  });
}));

/**
 * POST /api/jobs/run-all
 * Manually trigger all jobs (useful for testing)
 */
router.post('/run-all', asyncHandler(async (_req: Request, res: Response) => {
  const jobs = ['position-sync', 'daily-accrual', 'daily-reimbursement'];
  const results = [];

  for (const jobName of jobs) {
    try {
      const result = await runJob(jobName);
      results.push({
        jobName,
        success: result.success,
        error: result.error,
        executedAt: new Date().toISOString(),
      });
    } catch (error) {
      results.push({
        jobName,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executedAt: new Date().toISOString(),
      });
    }

    // Small delay between jobs to avoid overwhelming the system
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;

  res.json({
    message: `Executed ${results.length} jobs: ${successCount} successful, ${failureCount} failed`,
    results,
    summary: {
      total: results.length,
      successful: successCount,
      failed: failureCount,
    },
  });
}));

/**
 * POST /api/jobs/reset-and-sync
 * Clears all seeded/mock data and syncs fresh data from Morpho API
 * USE WITH CAUTION - this deletes all existing position data
 */
router.post('/reset-and-sync', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Starting database reset and fresh sync from Morpho');

  // Delete in correct order to respect foreign key constraints
  const deletedAlerts = await prisma.alert.deleteMany({});
  const deletedReimbursements = await prisma.reimbursement.deleteMany({});
  const deletedAccruals = await prisma.interestAccrual.deleteMany({});
  const deletedSnapshots = await prisma.dailySnapshot.deleteMany({});
  const deletedPositions = await prisma.position.deleteMany({});
  const deletedBorrowers = await prisma.borrower.deleteMany({});
  const deletedMarkets = await prisma.market.deleteMany({});

  logger.info(`Cleared database: ${deletedPositions.count} positions, ${deletedBorrowers.count} borrowers, ${deletedMarkets.count} markets, ${deletedAlerts.count} alerts`);

  // Now run position sync to get fresh data from Morpho
  const syncResult = await runJob('position-sync');

  if (!syncResult.success) {
    throw new AppError(`Position sync failed: ${syncResult.error}`, 500);
  }

  res.json({
    success: true,
    message: 'Database reset and synced with fresh Morpho data',
    deleted: {
      markets: deletedMarkets.count,
      positions: deletedPositions.count,
      borrowers: deletedBorrowers.count,
      accruals: deletedAccruals.count,
      reimbursements: deletedReimbursements.count,
      snapshots: deletedSnapshots.count,
      alerts: deletedAlerts.count,
    },
    syncCompleted: true,
  });
}));

/**
 * POST /api/jobs/clear-alerts
 * Clears all alerts from the database
 */
router.post('/clear-alerts', asyncHandler(async (_req: Request, res: Response) => {
  logger.info('Clearing all alerts from database');
  const deletedAlerts = await prisma.alert.deleteMany({});

  res.json({
    success: true,
    message: 'All alerts cleared',
    deleted: deletedAlerts.count,
  });
}));

/**
 * Get the next run time for a job based on its cron expression
 * This is a simplified implementation - in production you'd use a proper cron parser
 */
function getNextRunTime(jobName: string): string | null {
  const now = new Date();

  switch (jobName) {
    case 'position-sync':
      // Every 15 minutes
      const next15Min = new Date(now);
      const minutes = Math.ceil(now.getMinutes() / 15) * 15;
      next15Min.setMinutes(minutes, 0, 0);
      if (next15Min <= now) {
        next15Min.setMinutes(next15Min.getMinutes() + 15);
      }
      return next15Min.toISOString();

    case 'daily-accrual':
      // Every day at midnight UTC
      const nextMidnight = new Date(now);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);
      return nextMidnight.toISOString();

    case 'daily-reimbursement':
      // Every day at 1 AM UTC
      const next1AM = new Date(now);
      next1AM.setDate(next1AM.getDate() + 1);
      next1AM.setHours(1, 0, 0, 0);
      return next1AM.toISOString();

    default:
      return null;
  }
}

export default router;