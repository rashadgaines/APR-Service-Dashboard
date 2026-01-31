import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { getReimbursementHistory } from '@/services/reimbursement/processor';
import { asyncHandler } from '@/api/middleware/error';
import { validate, isValidAddress } from '@/api/middleware/validation';
import { Decimal } from 'decimal.js';
import { TOKEN_DECIMALS, TOKEN_PRICES } from '@/config/constants';

const router = Router();

// Validation schema for reimbursement query parameters
const reimbursementQuerySchema = z.object({
  limit: z.string().optional(),
  offset: z.string().optional(),
  borrowerAddress: z.string().optional(),
  marketId: z.string().optional(),
  status: z.enum(['pending', 'processed', 'failed']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

interface ReimbursementQueryOptions {
  limit?: number;
  offset?: number;
  borrowerAddress?: string;
  marketId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}

/**
 * GET /api/reimbursements
 * Returns reimbursement history with filtering
 */
router.get(
  '/',
  validate(reimbursementQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const query = req.query as z.infer<typeof reimbursementQuerySchema>;
      const options: ReimbursementQueryOptions = {};

      // Parse and validate query parameters
      if (query.limit) {
        options.limit = Math.min(Math.max(parseInt(query.limit), 1), 1000);
      }

      if (query.offset) {
        options.offset = Math.max(parseInt(query.offset), 0);
      }

      if (query.borrowerAddress && isValidAddress(query.borrowerAddress)) {
        options.borrowerAddress = query.borrowerAddress.toLowerCase();
      }

      if (query.marketId) {
        options.marketId = query.marketId;
      }

      if (query.status) {
        options.status = query.status;
      }

      if (query.startDate) {
        const date = new Date(query.startDate);
        if (!isNaN(date.getTime())) {
          options.startDate = date;
        }
      }

      if (query.endDate) {
        const date = new Date(query.endDate);
        if (!isNaN(date.getTime())) {
          options.endDate = date;
        }
      }

      const reimbursements = await getReimbursementHistory(options);

      res.json({
        reimbursements,
        total: reimbursements.length,
      });
    } catch (error) {
      console.error('Failed to fetch reimbursements:', error);
      res.json({
        reimbursements: [],
        total: 0,
        note: 'Reimbursement history temporarily unavailable'
      });
    }
  })
);

router.get('/summary', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Fetch individual records for proper normalization
  const [totalProcessed, recentRecords] = await Promise.all([
    prisma.reimbursement.findMany({
      where: { status: 'processed' },
      include: { position: { include: { market: true } } },
    }),
    prisma.reimbursement.findMany({
      where: {
        status: 'processed',
        createdAt: { gte: startDate }
      },
      include: { position: { include: { market: true } } },
    }),
  ]);

  const calculateUSD = (list: any[]) => {
    return list.reduce((sum, r) => {
      const loanAsset = r.position.market.loanAsset;
      const decimals = TOKEN_DECIMALS[loanAsset] || 18;
      const price = TOKEN_PRICES[loanAsset] || 0;
      const humanValue = new Decimal(r.amount.toString()).div(new Decimal(10).pow(decimals));
      return sum.add(humanValue.mul(price));
    }, new Decimal(0));
  };

  const totalUSD = calculateUSD(totalProcessed);
  const recentUSD = calculateUSD(recentRecords);

  // Group recent by market
  const marketMap = new Map<string, { amount: Decimal; count: number }>();
  for (const r of recentRecords) {
    const marketId = r.position.marketId;
    const loanAsset = r.position.market.loanAsset;
    const decimals = TOKEN_DECIMALS[loanAsset] || 18;
    const price = TOKEN_PRICES[loanAsset] || 0;
    const humanValue = new Decimal(r.amount.toString()).div(new Decimal(10).pow(decimals));
    const usdValue = humanValue.mul(price);

    const current = marketMap.get(marketId) || { amount: new Decimal(0), count: 0 };
    marketMap.set(marketId, {
      amount: current.amount.add(usdValue),
      count: current.count + 1,
    });
  }

  res.json({
    total: {
      amount: totalUSD.toFixed(2),
      count: totalProcessed.length,
    },
    recent: {
      amount: recentUSD.toFixed(2),
      count: recentRecords.length,
      period: `${days} days`,
    },
    byMarket: Array.from(marketMap.entries()).map(([marketId, data]) => ({
      marketId,
      amount: data.amount.toFixed(2),
      count: data.count,
    })),
  });
}));

export default router;