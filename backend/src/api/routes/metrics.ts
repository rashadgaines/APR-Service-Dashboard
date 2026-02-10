import { Router, Request, Response } from 'express';
import { prisma } from '@/config/database';
import { getDailyReimbursementTotals } from '@/services/reimbursement/processor';
import { asyncHandler } from '@/api/middleware/error';
import { Decimal } from 'decimal.js';
import { TOKEN_DECIMALS } from '@/config/constants';
import { fetchTokenPrices, getCachedPrices, getAllFallbackPrices } from '@/services/prices/fetcher';
import { logger } from '@/utils/logger';

// In-memory cache for metrics (updated every 3 seconds)
interface CachedMetrics {
  overview: any | null;
  markets: any | null;
  daily: any | null;
  lastUpdate: number;
}

const metricsCache: CachedMetrics = {
  overview: null,
  markets: null,
  daily: null,
  lastUpdate: 0,
};

const CACHE_TTL_MS = 3000; // 3 second cache for monitoring dashboard
let isCacheRefreshing = false;

const router = Router();

/**
 * Compute overview metrics (called in background to refresh cache)
 */
async function computeOverviewMetrics(): Promise<any> {
  try {
    const [
      totalBorrowers,
      activeBorrowersResult,
      positionsWithMarket,
      todayReimbursementsList,
      totalReimbursementsList,
    ] = await Promise.all([
      prisma.borrower.count(),
      prisma.position.groupBy({
        by: ['borrowerId'],
        where: { isActive: true },
        _count: true,
      }),
      prisma.position.findMany({
        where: { isActive: true },
        select: { principal: true, market: { select: { loanAsset: true } } },
      }),
      prisma.reimbursement.findMany({
        where: {
          date: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
            lt: new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
          },
          status: 'processed',
        },
        select: { amount: true, position: { select: { market: { select: { loanAsset: true } } } } },
      }),
      prisma.reimbursement.findMany({
        where: { status: 'processed' },
        select: { amount: true, position: { select: { market: { select: { loanAsset: true } } } } },
      }),
    ]);

    const activeBorrowers = activeBorrowersResult.length;
    const loanAssets = Array.from(
      new Set(positionsWithMarket.map(pos => pos.market.loanAsset))
    );

    // Get prices - use cached/fallback for immediate response, fetch in background
    let prices = getCachedPrices();

    // Kick off background price refresh
    if (loanAssets.length > 0) {
      fetchTokenPrices(loanAssets).catch(err => {
        logger.warn('Background price fetch failed', { error: err });
      });
    }

    let totalValueLocked = new Decimal(0);
    for (const pos of positionsWithMarket) {
      const loanAsset = pos.market.loanAsset;
      const decimals = TOKEN_DECIMALS[loanAsset] || 18;
      const price = prices[loanAsset] || 1;
      const humanValue = new Decimal(pos.principal.toString()).div(new Decimal(10).pow(decimals));
      totalValueLocked = totalValueLocked.add(humanValue.mul(price));
    }

    const calculateUSD = (list: any[], tokenPrices: Record<string, number>) => {
      return list.reduce((sum, r) => {
        const loanAsset = r.position.market.loanAsset;
        const decimals = TOKEN_DECIMALS[loanAsset] || 18;
        const price = tokenPrices[loanAsset] || 1;
        const humanValue = new Decimal(r.amount.toString()).div(new Decimal(10).pow(decimals));
        return sum.add(humanValue.mul(price));
      }, new Decimal(0));
    };

    const todayReimbursements = calculateUSD(todayReimbursementsList, prices);
    const totalReimbursements = calculateUSD(totalReimbursementsList, prices);

    let borrowersAboveCap = 0;
    try {
      const positionsWithExcess = await prisma.interestAccrual.findMany({
        where: {
          date: new Date(new Date().setHours(0, 0, 0, 0)),
          excessAmt: { gt: 0 },
        },
        select: { positionId: true },
        distinct: ['positionId'],
      });
      borrowersAboveCap = positionsWithExcess.length;
    } catch (error) {
      logger.warn('Could not calculate borrowers above cap:', { error });
    }

    const borrowersUnderCap = Math.max(0, activeBorrowers - borrowersAboveCap);

    logger.info('Overview metrics calculated', {
      totalBorrowers,
      activeBorrowers,
      tvl: totalValueLocked.toFixed(2),
    });

    return {
      totalBorrowers,
      activeBorrowers,
      borrowersUnderCap,
      borrowersAboveCap,
      totalValueLocked: totalValueLocked.toFixed(2),
      todayReimbursements: todayReimbursements.toFixed(2),
      totalReimbursements: totalReimbursements.toFixed(2),
    };
  } catch (error) {
    logger.error('Error computing overview metrics:', { error });
    return {
      totalBorrowers: 0,
      activeBorrowers: 0,
      borrowersUnderCap: 0,
      borrowersAboveCap: 0,
      totalValueLocked: "0.00",
      todayReimbursements: "0.00",
      totalReimbursements: "0.00",
    };
  }
}

/**
 * Compute market metrics (called in background to refresh cache)
 */
async function computeMarketMetrics(): Promise<any> {
  try {
    const markets = await prisma.market.findMany({
      include: {
        positions: {
          where: { isActive: true },
          select: { principal: true },
        },
        dailySnapshots: {
          orderBy: { date: 'desc' },
          take: 1,
          select: {
            totalBorrowed: true,
            borrowerCount: true,
            aboveCapCount: true,
          },
        },
      },
    });

    const loanAssets = Array.from(new Set(markets.map(m => m.loanAsset)));
    let prices = getCachedPrices();

    // Background refresh
    if (loanAssets.length > 0) {
      fetchTokenPrices(loanAssets).catch(err => {
        logger.warn('Background market price fetch failed', { error: err });
      });
    }

    const marketMetrics = markets.map(market => {
      const totalBorrowedRaw = market.dailySnapshots[0]?.totalBorrowed || new Decimal(0);
      const borrowerCount = market.dailySnapshots[0]?.borrowerCount || 0;
      const aboveCapCount = market.dailySnapshots[0]?.aboveCapCount || 0;

      const decimals = TOKEN_DECIMALS[market.loanAsset] || 18;
      const price = prices[market.loanAsset] || 1;
      const humanBorrowed = totalBorrowedRaw.div(new Decimal(10).pow(decimals));
      const usdBorrowed = humanBorrowed.mul(price);

      return {
        id: market.marketId,
        name: market.name,
        totalBorrowed: usdBorrowed.toFixed(2),
        borrowerCount,
        aboveCapCount,
        utilizationRate: borrowerCount > 0 ? ((aboveCapCount / borrowerCount) * 100).toFixed(1) : '0.0',
      };
    });

    logger.info('Market metrics calculated', { marketCount: markets.length });
    return { markets: marketMetrics };
  } catch (error) {
    logger.error('Error computing market metrics:', { error });
    return { markets: [] };
  }
}

/**
 * Compute daily metrics (called in background to refresh cache)
 */
async function computeDailyMetrics(): Promise<any> {
  try {
    const days = 30;
    const dailyData = await getDailyReimbursementTotals(days);

    return {
      data: dailyData.map(item => ({
        date: item.date,
        amount: item.amount.toFixed(2),
        count: item.count,
      })),
    };
  } catch (error) {
    logger.error('Error computing daily metrics:', { error });
    return {
      data: [],
      note: "Reimbursement data not yet available or API services temporarily unavailable"
    };
  }
}

/**
 * Refresh cache in background without blocking
 */
function refreshCacheIfNeeded() {
  const now = Date.now();
  if (now - metricsCache.lastUpdate > CACHE_TTL_MS && !isCacheRefreshing) {
    isCacheRefreshing = true;
    
    Promise.all([
      computeOverviewMetrics(),
      computeMarketMetrics(),
      computeDailyMetrics(),
    ]).then(([overview, markets, daily]) => {
      metricsCache.overview = overview;
      metricsCache.markets = markets;
      metricsCache.daily = daily;
      metricsCache.lastUpdate = now;
      isCacheRefreshing = false;
    }).catch(err => {
      logger.error('Error refreshing metrics cache:', { error: err });
      isCacheRefreshing = false;
    });
  }
}

/**
 * GET /api/metrics/overview
 * Returns system-wide metrics for the dashboard (cached)
 */
router.get('/overview', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Force bypass cache if requested
    if (req.query.force === '1') {
      const overview = await computeOverviewMetrics();
      metricsCache.overview = overview;
      metricsCache.lastUpdate = Date.now();
      return res.json(overview);
    }

    // Refresh cache in background if needed
    refreshCacheIfNeeded();

    // Return cached data immediately
    if (metricsCache.overview) {
      return res.json(metricsCache.overview);
    }

    // On first request, compute immediately
    const overview = await computeOverviewMetrics();
    metricsCache.overview = overview;
    metricsCache.lastUpdate = Date.now();
    res.json(overview);
  } catch (error) {
    logger.error('Error in overview metrics endpoint:', error);
    res.json({
      totalBorrowers: 0,
      activeBorrowers: 0,
      borrowersUnderCap: 0,
      borrowersAboveCap: 0,
      totalValueLocked: "0.00",
      todayReimbursements: "0.00",
      totalReimbursements: "0.00",
      _error: 'Metrics temporarily unavailable'
    });
  }
}));

/**
 * GET /api/metrics/daily
 * Returns daily reimbursement data for charting (cached)
 */
router.get('/daily', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Force bypass cache if requested
    if (req.query.force === '1') {
      const daily = await computeDailyMetrics();
      metricsCache.daily = daily;
      metricsCache.lastUpdate = Date.now();
      return res.json(daily);
    }

    // Refresh cache in background if needed
    refreshCacheIfNeeded();

    // Return cached data immediately
    if (metricsCache.daily) {
      return res.json(metricsCache.daily);
    }

    // On first request, compute immediately
    const daily = await computeDailyMetrics();
    metricsCache.daily = daily;
    metricsCache.lastUpdate = Date.now();
    res.json(daily);
  } catch (error) {
    logger.error('Error in daily metrics endpoint:', error);
    res.json({ 
      data: [],
      _error: 'Daily metrics temporarily unavailable'
    });
  }
}));

/**
 * GET /api/metrics/markets
 * Returns market-level metrics (cached)
 */
router.get('/markets', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Force bypass cache if requested
    if (req.query.force === '1') {
      const markets = await computeMarketMetrics();
      metricsCache.markets = markets;
      metricsCache.lastUpdate = Date.now();
      return res.json(markets);
    }

    // Refresh cache in background if needed
    refreshCacheIfNeeded();

    // Return cached data immediately
    if (metricsCache.markets) {
      return res.json(metricsCache.markets);
    }

    // On first request, compute immediately
    const markets = await computeMarketMetrics();
    metricsCache.markets = markets;
    metricsCache.lastUpdate = Date.now();
    res.json(markets);
  } catch (error) {
    logger.error('Error in markets metrics endpoint:', error);
    res.json({ 
      markets: [],
      _error: 'Market metrics temporarily unavailable'
    });
  }
}));

export default router;