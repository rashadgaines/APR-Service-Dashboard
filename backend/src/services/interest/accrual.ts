import { prisma } from '@/config/database';
import { getMarketAPR } from '@/services/morpho/queries';
import { calculateExcessInterest, calculateDailyInterest } from './calculator';
import { getMarketById } from '@/config/constants';
import { logger } from '@/utils/logger';
import { Decimal } from 'decimal.js';

export interface AccrualResult {
  date: Date;
  positionsProcessed: number;
  totalAccrued: Decimal;
  totalExcess: Decimal;
  errors: string[];
}

/**
 * Process daily interest accrual for all active positions
 * This runs once per day at midnight UTC
 */
export async function processDailyAccrual(targetDate: Date = new Date()): Promise<AccrualResult> {
  const result: AccrualResult = {
    date: targetDate,
    positionsProcessed: 0,
    totalAccrued: new Decimal(0),
    totalExcess: new Decimal(0),
    errors: [],
  };

  // Normalize to date (remove time component)
  const date = new Date(targetDate);
  date.setHours(0, 0, 0, 0);

  try {
    logger.info(`Starting daily interest accrual for ${date.toISOString().split('T')[0]}`);

    // Get all active positions
    const positions = await prisma.position.findMany({
      where: { isActive: true },
      include: { market: true },
    });

    for (const position of positions) {
      try {
        // Get current APR for this market
        const actualAprBps = await getMarketAPR(position.market.marketId);
        const marketConfig = getMarketById(position.market.marketId);

        if (!marketConfig?.aprCapBps) {
          const errorMsg = `No APR cap configured for market ${position.market.name}`;
          logger.warn(errorMsg);
          result.errors.push(errorMsg);
          continue;
        }

        const capAprBps = marketConfig.aprCapBps;

        // Calculate daily interest
        const principal = new Decimal(position.principal.toString());
        const dailyInterest = calculateDailyInterest(principal, actualAprBps);
        const excessInterest = calculateExcessInterest(principal, actualAprBps, capAprBps);

        // Record accrual
        await prisma.interestAccrual.create({
          data: {
            positionId: position.id,
            date,
            accruedAmt: dailyInterest,
            actualApr: actualAprBps / 10000, // Convert bps to decimal
            cappedApr: capAprBps / 10000,
            excessAmt: excessInterest,
          },
        });

        result.positionsProcessed++;
        result.totalAccrued = result.totalAccrued.add(dailyInterest);
        result.totalExcess = result.totalExcess.add(excessInterest);

        logger.debug(
          `Processed position ${position.id}: principal=${principal.toString()}, ` +
          `actual=${actualAprBps}bps, cap=${capAprBps}bps, excess=${excessInterest.toString()}`
        );

      } catch (error) {
        const errorMsg = `Failed to process accrual for position ${position.id}: ${error}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    logger.info(
      `Daily accrual completed: ${result.positionsProcessed} positions, ` +
      `total accrued: ${result.totalAccrued.toString()}, total excess: ${result.totalExcess.toString()}`
    );

  } catch (error) {
    const errorMsg = `Daily accrual processing failed: ${error}`;
    logger.error(errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Get pending reimbursements that haven't been processed yet
 */
export async function getPendingReimbursements(): Promise<Array<{
  positionId: string;
  date: Date;
  excessAmt: Decimal;
  borrowerAddress: string;
  marketName: string;
  loanAsset: string;
}>> {
  // Get all accruals with excess > 0
  const accruals = await prisma.interestAccrual.findMany({
    where: {
      excessAmt: { gt: 0 },
    },
    include: {
      position: {
        include: {
          borrower: true,
          market: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Get all processed reimbursements to filter them out
  const processedReimbursements = await prisma.reimbursement.findMany({
    where: {
      status: { in: ['processed', 'pending'] },
    },
    select: {
      positionId: true,
      date: true,
    },
  });

  // Create a set of processed position+date combinations
  const processedSet = new Set(
    processedReimbursements.map((r) => `${r.positionId}:${r.date.toISOString()}`)
  );

  // Filter out already processed accruals
  return accruals
    .filter((accrual) => !processedSet.has(`${accrual.positionId}:${accrual.date.toISOString()}`))
    .map((accrual) => ({
      positionId: accrual.positionId,
      date: accrual.date,
      excessAmt: new Decimal(accrual.excessAmt.toString()),
      borrowerAddress: accrual.position.borrower.address,
      marketName: accrual.position.market.name,
      loanAsset: accrual.position.market.loanAsset,
    }));
}

/**
 * Calculate total pending reimbursements by borrower
 */
export async function getPendingReimbursementsByBorrower(): Promise<Array<{
  borrowerAddress: string;
  totalAmount: Decimal;
  positionCount: number;
  marketNames: string[];
}>> {
  const pending = await getPendingReimbursements();

  const byBorrower = new Map<string, {
    totalAmount: Decimal;
    positionCount: number;
    marketNames: Set<string>;
  }>();

  for (const item of pending) {
    const existing = byBorrower.get(item.borrowerAddress) || {
      totalAmount: new Decimal(0),
      positionCount: 0,
      marketNames: new Set<string>(),
    };

    existing.totalAmount = existing.totalAmount.add(item.excessAmt);
    existing.positionCount++;
    existing.marketNames.add(item.marketName);

    byBorrower.set(item.borrowerAddress, existing);
  }

  return Array.from(byBorrower.entries()).map(([borrowerAddress, data]) => ({
    borrowerAddress,
    totalAmount: data.totalAmount,
    positionCount: data.positionCount,
    marketNames: Array.from(data.marketNames),
  }));
}