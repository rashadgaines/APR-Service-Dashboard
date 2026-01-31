import { Router, Request, Response } from 'express';
import { prisma } from '@/config/database';
import { getMarketAPR } from '@/services/morpho/queries';
import { MARKETS, TOKEN_DECIMALS, TOKEN_PRICES } from '@/config/constants';
import { asyncHandler, AppError } from '@/api/middleware/error';
import { Decimal } from 'decimal.js';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/markets
 * Returns list of all markets with current stats
 */
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const markets = await prisma.market.findMany({
      include: {
        _count: {
          select: { positions: { where: { isActive: true } } },
        },
        positions: {
          where: { isActive: true },
          select: { principal: true },
        },
        dailySnapshots: {
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
    });

    if (markets.length === 0) {
      return res.json({ markets: [], note: 'No markets currently initialized in database' });
    }

    // Get current APRs for all markets (with timeout to prevent hanging)
    const marketAPRs = new Map<string, number>();
    const APR_TIMEOUT = 2000; // 2 second timeout per market
    
    await Promise.all(
      markets.map(async (market) => {
        try {
          const aprPromise = getMarketAPR(market.marketId);
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('APR fetch timeout')), APR_TIMEOUT)
          );
          const apr = await Promise.race([aprPromise, timeoutPromise]);
          marketAPRs.set(market.marketId, apr);
        } catch (error) {
          logger.warn(`Failed to fetch APR for market ${market.marketId}:`, { error });
          marketAPRs.set(market.marketId, 0);
        }
      })
    );

    const marketData = markets.map(market => {
      const config = Object.values(MARKETS).find(m => m.id === market.marketId);
      const currentApr = marketAPRs.get(market.marketId) || 0;
      const capApr = config?.aprCapBps || 0;

      // Use REAL position data, not snapshots
      const activePositions = market.positions || [];
      const borrowerCount = market._count?.positions || activePositions.length;

      // Calculate total borrowed from REAL positions
      const totalBorrowedRaw = activePositions.reduce(
        (sum, pos) => sum.add(new Decimal(pos.principal.toString())),
        new Decimal(0)
      );

      // Convert from wei to human-readable decimal
      const decimals = TOKEN_DECIMALS[market.loanAsset] || 18;
      const totalBorrowedHuman = totalBorrowedRaw.div(new Decimal(10).pow(decimals));
      const price = TOKEN_PRICES[market.loanAsset] || 1;
      const totalBorrowedUSD = totalBorrowedHuman.mul(price);

      // Calculate above cap count from REAL current APR
      const isAboveCap = currentApr > capApr;
      const aboveCapCount = isAboveCap ? borrowerCount : 0;

      return {
        id: market.marketId,
        name: market.name,
        collateralAsset: market.collateralAsset,
        loanAsset: market.loanAsset,
        lltv: (parseFloat(market.lltv.toString()) * 100).toFixed(1) + '%',
        aprCap: (capApr / 100).toFixed(2) + '%',
        currentApr: (currentApr / 100).toFixed(2) + '%',
        aprRatio: capApr > 0 ? (currentApr / capApr).toFixed(2) : '0.00',
        totalBorrowed: totalBorrowedUSD.toFixed(2),
        borrowerCount,
        aboveCapCount,
        utilizationRate: borrowerCount > 0 ? ((aboveCapCount / borrowerCount) * 100).toFixed(1) : '0.0',
      };
    });

    res.json({ markets: marketData });
  } catch (error) {
    console.error('Failed to fetch markets:', error);
    res.status(503).json({
      error: 'Service Unavailable',
      message: 'Database connection failed or markets not initialized',
      markets: []
    });
  }
}));

/**
 * GET /api/markets/:id
 * Returns detailed information for a specific market
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const market = await prisma.market.findUnique({
    where: { marketId: id },
    include: {
      positions: {
        where: { isActive: true },
        include: {
          borrower: true,
          interestAccruals: {
            orderBy: { date: 'desc' },
            take: 30, // Last 30 days
          },
          reimbursements: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      },
      dailySnapshots: {
        orderBy: { date: 'desc' },
        take: 30, // Last 30 days
      },
    },
  });

  if (!market) {
    throw new AppError('Market not found', 404);
  }

  // Get current APR
  let currentApr = 0;
  try {
    currentApr = await getMarketAPR(market.marketId);
  } catch (error) {
    // Continue with 0 APR if API fails
  }

  const config = Object.values(MARKETS).find(m => m.id === market.marketId);

  // Calculate summary stats
  const totalBorrowedRaw = market.positions.reduce(
    (sum, pos) => sum.add(new Decimal(pos.principal.toString())),
    new Decimal(0)
  );

  // Convert to USD
  const decimals = TOKEN_DECIMALS[market.loanAsset] || 18;
  const totalBorrowedHuman = totalBorrowedRaw.div(new Decimal(10).pow(decimals));
  const price = TOKEN_PRICES[market.loanAsset] || 1;
  const totalBorrowedUSD = totalBorrowedHuman.mul(price);

  const totalReimbursements = await prisma.reimbursement.aggregate({
    where: {
      position: { marketId: market.marketId },
      status: 'processed',
    },
    _sum: { amount: true },
  });

  const recentAccruals = market.dailySnapshots.slice(0, 7); // Last 7 days

  res.json({
    market: {
      id: market.marketId,
      name: market.name,
      collateralAsset: market.collateralAsset,
      loanAsset: market.loanAsset,
      lltv: (parseFloat(market.lltv.toString()) * 100).toFixed(1) + '%',
      aprCap: config ? (config.aprCapBps / 100).toFixed(2) + '%' : 'N/A',
      currentApr: (currentApr / 100).toFixed(2) + '%',
      totalBorrowed: totalBorrowedUSD.toFixed(2),
      borrowerCount: market.positions.length,
      totalReimbursements: new Decimal(totalReimbursements._sum.amount?.toString() || '0').toFixed(2),
    },
    positions: market.positions.map(pos => ({
      id: pos.id,
      borrowerAddress: pos.borrower.address,
      principal: pos.principal.toString(),
      collateral: pos.collateral.toString(),
      openedAt: pos.openedAt,
      recentAccruals: pos.interestAccruals.slice(0, 5),
      recentReimbursements: pos.reimbursements.slice(0, 3),
    })),
    recentSnapshots: recentAccruals.map(snapshot => ({
      date: snapshot.date.toISOString().split('T')[0],
      totalBorrowed: snapshot.totalBorrowed.toString(),
      avgApr: snapshot.avgApr.toString(),
      borrowerCount: snapshot.borrowerCount,
      aboveCapCount: snapshot.aboveCapCount,
    })),
  });
}));

/**
 * GET /api/markets/:id/borrowers
 * Returns borrowers for a specific market
 */
router.get('/:id/borrowers', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;

  const positions = await prisma.position.findMany({
    where: {
      marketId: id,
      isActive: true,
    },
    include: {
      borrower: true,
      interestAccruals: {
        where: {
          date: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        orderBy: { date: 'desc' },
      },
      reimbursements: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  const borrowers = positions.map(pos => {
    const totalExcess = pos.interestAccruals.reduce(
      (sum, accrual) => sum.add(new Decimal(accrual.excessAmt.toString())),
      new Decimal(0)
    );

    const totalReimbursed = pos.reimbursements.reduce(
      (sum, reimbursement) => sum.add(new Decimal(reimbursement.amount.toString())),
      new Decimal(0)
    );

    return {
      address: pos.borrower.address,
      positionId: pos.id,
      principal: pos.principal.toString(),
      collateral: pos.collateral.toString(),
      totalExcess: totalExcess.toString(),
      totalReimbursed: totalReimbursed.toString(),
      pendingReimbursement: totalExcess.sub(totalReimbursed).toString(),
      lastActivity: pos.interestAccruals[0]?.date || pos.openedAt,
    };
  });

  res.json({ borrowers });
}));

export default router;