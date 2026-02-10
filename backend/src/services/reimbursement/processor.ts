import { prisma } from '@/config/database';
import { getPendingReimbursementsByBorrower } from '@/services/interest/accrual';
import { logger } from '@/utils/logger';
import { Decimal } from 'decimal.js';
import { env } from '@/config/env';
import { LOAN_ASSET_TO_TOKEN, TOKEN_DECIMALS } from '@/config/constants';
import { executeTokenTransfer, isWalletReady, type TransactionResult } from '@/services/blockchain';
import { fetchTokenPrices } from '@/services/prices/fetcher';
import type { Address } from 'viem';

export interface ReimbursementResult {
  borrowersProcessed: number;
  totalReimbursed: Decimal;
  transactionsCreated: number;
  errors: string[];
}

/**
 * Process pending reimbursements
 * Groups by borrower and loan asset, then executes reimbursements
 * All reimbursements are real on-chain transactions (no mock mode)
 */
export async function processReimbursements(): Promise<ReimbursementResult> {
  const result: ReimbursementResult = {
    borrowersProcessed: 0,
    totalReimbursed: new Decimal(0),
    transactionsCreated: 0,
    errors: [],
  };

  try {
    logger.info('Starting reimbursement processing (real on-chain transactions)');

    // Get pending accruals with position and market info
    const pendingAccruals = await prisma.interestAccrual.findMany({
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

    // Check if any accruals have already been reimbursed
    const accrualIds = pendingAccruals.map(a => a.id);
    const existingReimbursements = await prisma.reimbursement.findMany({
      where: {
        position: {
          interestAccruals: {
            some: { id: { in: accrualIds } },
          },
        },
      },
      select: { positionId: true, date: true },
    });

    // Create a set of already-processed position+date combinations
    const processedKeys = new Set(
      existingReimbursements.map(r => `${r.positionId}-${r.date.toISOString().split('T')[0]}`)
    );

    // Filter out already processed accruals
    const unprocessedAccruals = pendingAccruals.filter(a => {
      const key = `${a.positionId}-${a.date.toISOString().split('T')[0]}`;
      return !processedKeys.has(key);
    });

    if (unprocessedAccruals.length === 0) {
      logger.info('No pending reimbursements to process');
      return result;
    }

    // Group by borrower AND loan asset (since we need separate tx per token type)
    type AccrualGroup = {
      borrowerAddress: string;
      loanAsset: string;
      totalAmount: Decimal;
      accruals: Array<{ id: string; positionId: string; excessAmt: Decimal; date: Date }>;
    };

    const groupedMap = new Map<string, AccrualGroup>();

    for (const accrual of unprocessedAccruals) {
      const borrowerAddress = accrual.position.borrower.address;
      const loanAsset = accrual.position.market.loanAsset;
      const key = `${borrowerAddress}-${loanAsset}`;

      const group = groupedMap.get(key) || {
        borrowerAddress,
        loanAsset,
        totalAmount: new Decimal(0),
        accruals: [],
      };

      const excessAmt = new Decimal(accrual.excessAmt.toString());
      group.totalAmount = group.totalAmount.add(excessAmt);
      group.accruals.push({
        id: accrual.id,
        positionId: accrual.positionId,
        excessAmt,
        date: accrual.date,
      });

      groupedMap.set(key, group);
    }

    const processedBorrowers = new Set<string>();

    // Process each group (borrower + loan asset combination)
    for (const group of groupedMap.values()) {
      try {
        const { borrowerAddress, loanAsset, totalAmount, accruals } = group;

        // Execute on-chain reimbursement
        const { txHash, status } = await executeReimbursement(
          borrowerAddress,
          totalAmount,
          loanAsset
        );

        // Only create reimbursement records if transaction succeeded
        if (status === 'failed') {
          const errorMsg = `On-chain reimbursement failed for ${borrowerAddress} (${loanAsset})`;
          logger.error(errorMsg);
          result.errors.push(errorMsg);

          // Create failed reimbursement records for tracking
          await createReimbursementRecords(accruals, null, 'failed');
          continue;
        }

        // Create reimbursement records in database
        await createReimbursementRecords(accruals, txHash, 'processed');

        processedBorrowers.add(borrowerAddress);
        result.totalReimbursed = result.totalReimbursed.add(totalAmount);
        result.transactionsCreated++;

        logger.info(
          `Processed reimbursement for ${borrowerAddress}: ${totalAmount.toString()} ${loanAsset} ` +
          `(tx: ${txHash}, status: ${status})`
        );

      } catch (error) {
        const errorMsg = `Failed to process reimbursement for ${group.borrowerAddress}: ${error}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    result.borrowersProcessed = processedBorrowers.size;

    logger.info(
      `Reimbursement processing completed: ${result.borrowersProcessed} borrowers, ` +
      `${result.transactionsCreated} transactions, total reimbursed: ${result.totalReimbursed.toString()}`
    );

  } catch (error) {
    const errorMsg = `Reimbursement processing failed: ${error}`;
    logger.error(errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Helper to create reimbursement records grouped by position
 */
async function createReimbursementRecords(
  accruals: Array<{ id: string; positionId: string; excessAmt: Decimal; date: Date }>,
  txHash: string | null,
  status: string
): Promise<void> {
  // Group accruals by position
  const byPosition = new Map<string, Decimal>();
  for (const accrual of accruals) {
    const current = byPosition.get(accrual.positionId) || new Decimal(0);
    byPosition.set(accrual.positionId, current.add(accrual.excessAmt));
  }

  // Create a reimbursement record for each position
  await prisma.$transaction(async (tx) => {
    for (const [positionId, amount] of byPosition.entries()) {
      if (amount.gt(0)) {
        await tx.reimbursement.create({
          data: {
            positionId,
            date: new Date(),
            amount,
            txHash,
            status,
          },
        });
      }
    }
  }, {
    maxWait: 5000,
    timeout: 10000,
  });
}

/**
 * Execute reimbursement transaction
 * Sends ERC20 tokens to the borrower address
 */
async function executeReimbursement(
  borrowerAddress: string,
  amount: Decimal,
  loanAsset: string
): Promise<{ txHash: string | null; status: 'processed' | 'failed' }> {
  // Validate wallet is ready for real on-chain transactions
  if (!isWalletReady()) {
    logger.error(`Wallet not initialized - cannot execute reimbursement for ${borrowerAddress}`);
    return { txHash: null, status: 'failed' };
  }

  // Get the token address for the loan asset
  const tokenAddress = LOAN_ASSET_TO_TOKEN[loanAsset];
  if (!tokenAddress) {
    logger.error(`No token address configured for loan asset: ${loanAsset}`);
    return { txHash: null, status: 'failed' };
  }

  // Convert amount to BigInt (amounts are stored in token's smallest unit)
  const amountBigInt = BigInt(amount.toFixed(0));

  logger.info(`Executing on-chain reimbursement: ${borrowerAddress} -> ${amount.toString()} ${loanAsset}`);

  // Execute the token transfer
  const result: TransactionResult = await executeTokenTransfer({
    tokenAddress: tokenAddress as Address,
    recipientAddress: borrowerAddress as Address,
    amount: amountBigInt,
  });

  if (result.success && result.hash) {
    logger.info(`Reimbursement successful: ${result.hash} (gas used: ${result.gasUsed})`);
    return { txHash: result.hash, status: 'processed' };
  } else {
    logger.error(`Reimbursement failed: ${result.error}`);
    return { txHash: null, status: 'failed' };
  }
}

/**
 * Get reimbursement history with filtering options
 */
export async function getReimbursementHistory(options: {
  limit?: number;
  offset?: number;
  borrowerAddress?: string;
  marketId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
} = {}): Promise<Array<{
  id: string;
  positionId: string;
  borrowerAddress: string;
  marketName: string;
  date: Date;
  amount: Decimal;
  txHash: string | null;
  status: string;
  createdAt: Date;
}>> {
  const where: any = {};

  if (options.borrowerAddress) {
    where.position = {
      borrower: { address: options.borrowerAddress },
    };
  }

  if (options.marketId) {
    where.position = {
      ...where.position,
      market: { marketId: options.marketId },
    };
  }

  if (options.status) {
    where.status = options.status;
  }

  if (options.startDate || options.endDate) {
    where.date = {};
    if (options.startDate) where.date.gte = options.startDate;
    if (options.endDate) where.date.lte = options.endDate;
  }

  const reimbursements = await prisma.reimbursement.findMany({
    where,
    include: {
      position: {
        include: {
          borrower: true,
          market: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit || 50,
    skip: options.offset || 0,
  });

  return reimbursements.map((r) => {
    const loanAsset = r.position.market.loanAsset;
    const decimals = TOKEN_DECIMALS[loanAsset] || 18;
    const humanAmount = new Decimal(r.amount.toString()).div(new Decimal(10).pow(decimals));

    return {
      id: r.id,
      positionId: r.positionId,
      borrowerAddress: r.position.borrower.address,
      marketName: r.position.market.name,
      date: r.date,
      amount: humanAmount,
      txHash: r.txHash,
      status: r.status,
      createdAt: r.createdAt,
    };
  });
}

/**
 * Get daily reimbursement totals for charting
 */
export async function getDailyReimbursementTotals(days: number = 30): Promise<Array<{
  date: string;
  amount: Decimal;
  count: number;
}>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const reimbursements = await prisma.reimbursement.findMany({
    where: {
      date: { gte: startDate },
      status: 'processed',
    },
    include: {
      position: {
        include: {
          market: true,
        },
      },
    },
    orderBy: { date: 'asc' },
  });

  const dailyMap = new Map<string, { amount: Decimal; count: number }>();

  // Fetch real-time prices for all loan assets
  const loanAssets = [...new Set(reimbursements.map(r => r.position.market.loanAsset))];
  const priceMap = await fetchTokenPrices(loanAssets);

  for (const r of reimbursements) {
    const dateStr = r.date.toISOString().split('T')[0];
    const loanAsset = r.position.market.loanAsset;
    const decimals = TOKEN_DECIMALS[loanAsset] ?? 18;
    const price = priceMap[loanAsset] ?? 0;

    const humanAmount = new Decimal(r.amount.toString()).div(new Decimal(10).pow(decimals));
    const usdValue = humanAmount.mul(price);

    const current = dailyMap.get(dateStr) || { amount: new Decimal(0), count: 0 };
    dailyMap.set(dateStr, {
      amount: current.amount.add(usdValue),
      count: current.count + 1,
    });
  }

  return Array.from(dailyMap.entries()).map(([date, data]) => ({
    date,
    amount: data.amount,
    count: data.count,
  }));
}