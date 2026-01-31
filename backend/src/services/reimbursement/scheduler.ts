import cron from 'node-cron';
import { syncPositions } from '@/services/sync/positions';
import { processDailyAccrual } from '@/services/interest/accrual';
import { processReimbursements } from './processor';
import { logger } from '@/utils/logger';
import { JOB_INTERVALS } from '@/config/constants';

// Job status tracking
interface JobStatus {
  name: string;
  lastRun: Date | null;
  isRunning: boolean;
  error: string | null;
}

const jobStatuses: Map<string, JobStatus> = new Map();

/**
 * Initialize and start all scheduled jobs
 */
export function startScheduler(): void {
  logger.info('Starting job scheduler');

  // Position sync job - every 15 minutes
  scheduleJob(
    'position-sync',
    `*/${JOB_INTERVALS.POSITION_SYNC_MINUTES} * * * *`,
    async () => {
      logger.info('Running position sync job');
      const result = await syncPositions();

      if (result.errors.length > 0) {
        logger.warn(`Position sync completed with ${result.errors.length} errors`);
      } else {
        logger.info(`Position sync completed successfully: ${result.positionsCreated} created, ${result.positionsUpdated} updated`);
      }
    }
  );

  // Daily accrual job - every day at midnight UTC
  scheduleJob(
    'daily-accrual',
    `0 ${JOB_INTERVALS.DAILY_ACCRUAL_HOUR} * * *`,
    async () => {
      logger.info('Running daily accrual job');
      const result = await processDailyAccrual();

      if (result.errors.length > 0) {
        logger.error(`Daily accrual completed with ${result.errors.length} errors`);
      } else {
        logger.info(`Daily accrual completed: ${result.positionsProcessed} positions processed`);
      }
    }
  );

  // Daily reimbursement job - every day at 1 AM UTC
  scheduleJob(
    'daily-reimbursement',
    `0 ${JOB_INTERVALS.DAILY_REIMBURSEMENT_HOUR} * * *`,
    async () => {
      logger.info('Running daily reimbursement job (real on-chain transactions)');
      const result = await processReimbursements();

      if (result.errors.length > 0) {
        logger.error(`Daily reimbursement completed with ${result.errors.length} errors`);
      } else {
        logger.info(`Daily reimbursement completed: ${result.borrowersProcessed} borrowers processed, ${result.transactionsCreated} transactions`);
      }
    }
  );

  logger.info('All scheduled jobs have been initialized');
}

/**
 * Stop all scheduled jobs
 */
export function stopScheduler(): void {
  logger.info('Stopping job scheduler');
  // node-cron doesn't provide a direct way to stop all jobs,
  // but we can destroy the cron instances by clearing the map
  jobStatuses.clear();
}

/**
 * Schedule a job with error handling and status tracking
 */
function scheduleJob(name: string, cronExpression: string, jobFunction: () => Promise<void>): void {
  // Initialize job status
  jobStatuses.set(name, {
    name,
    lastRun: null,
    isRunning: false,
    error: null,
  });

  // Schedule the job
  cron.schedule(cronExpression, async () => {
    const status = jobStatuses.get(name)!;

    if (status.isRunning) {
      logger.warn(`Job ${name} is already running, skipping execution`);
      return;
    }

    try {
      status.isRunning = true;
      status.error = null;

      await jobFunction();

      status.lastRun = new Date();
      status.error = null;

    } catch (error) {
      const errorMsg = `Job ${name} failed: ${error}`;
      logger.error(errorMsg);
      status.error = errorMsg;
    } finally {
      status.isRunning = false;
    }
  });

  logger.info(`Scheduled job: ${name} (${cronExpression})`);
}

/**
 * Get status of all jobs
 */
export function getJobStatuses(): JobStatus[] {
  return Array.from(jobStatuses.values());
}

/**
 * Manually run a job (for testing or manual execution)
 */
export async function runJob(jobName: string): Promise<{ success: boolean; error?: string }> {
  const jobs: Record<string, () => Promise<void>> = {
    'position-sync': async () => {
      const result = await syncPositions();
      if (result.errors.length > 0) {
        throw new Error(`Position sync had ${result.errors.length} errors`);
      }
    },
    'daily-accrual': async () => {
      const result = await processDailyAccrual();
      if (result.errors.length > 0) {
        throw new Error(`Daily accrual had ${result.errors.length} errors`);
      }
    },
    'daily-reimbursement': async () => {
      const result = await processReimbursements();
      if (result.errors.length > 0) {
        throw new Error(`Daily reimbursement had ${result.errors.length} errors`);
      }
    },
  };

  const jobFunction = jobs[jobName];
  if (!jobFunction) {
    return { success: false, error: `Unknown job: ${jobName}` };
  }

  try {
    logger.info(`Manually running job: ${jobName}`);
    await jobFunction();
    logger.info(`Job ${jobName} completed successfully`);
    return { success: true };
  } catch (error) {
    const errorMsg = `Job ${jobName} failed: ${error}`;
    logger.error(errorMsg);
    return { success: false, error: errorMsg };
  }
}