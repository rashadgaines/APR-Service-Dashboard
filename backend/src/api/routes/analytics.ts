import { Router, Request, Response } from 'express';
import { prisma } from '@/config/database';
import { getDailyReimbursementTotals } from '@/services/reimbursement/processor';
import { fetchTokenPrices, getCachedPrices } from '@/services/prices/fetcher';
import { asyncHandler } from '@/api/middleware/error';
import { TOKEN_DECIMALS } from '@/config/constants';
import { Decimal } from 'decimal.js';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * GET /api/analytics/reimbursements?days=30
 * Daily reimbursement totals for charting
 */
router.get('/reimbursements', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);

  const totals = await getDailyReimbursementTotals(days);

  res.json({
    data: totals.map(item => ({
      date: item.date,
      amountUsd: item.amount.toFixed(2),
      count: item.count,
    })),
  });
}));

/**
 * GET /api/analytics/efficiency?days=30
 * Median and p95 time between interest accrual and reimbursement
 */
router.get('/efficiency', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const reimbursements = await prisma.reimbursement.findMany({
    where: {
      createdAt: { gte: startDate },
      status: 'processed',
    },
    select: {
      positionId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const durations: number[] = [];

  for (const r of reimbursements) {
    const latestAccrual = await prisma.interestAccrual.findFirst({
      where: {
        positionId: r.positionId,
        date: { lte: r.createdAt },
      },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    if (latestAccrual) {
      const diffMs = r.createdAt.getTime() - latestAccrual.date.getTime();
      durations.push(diffMs / 60000); // convert to minutes
    }
  }

  if (durations.length === 0) {
    return res.json({ medianMinutes: 0, p95Minutes: 0, sampleSize: 0 });
  }

  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.floor(durations.length * 0.95)];

  res.json({
    medianMinutes: Math.round(median),
    p95Minutes: Math.round(p95),
    sampleSize: durations.length,
  });
}));

/**
 * GET /api/analytics/excess-interest?days=30
 * Excess interest aggregated by market, converted to USD
 */
router.get('/excess-interest', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const accruals = await prisma.interestAccrual.findMany({
    where: {
      date: { gte: startDate },
      excessAmt: { gt: 0 },
    },
    include: {
      position: {
        include: { market: true },
      },
    },
  });

  // Group by market
  const byMarket = new Map<string, {
    marketId: string;
    marketName: string;
    loanAsset: string;
    totalExcess: Decimal;
    aprSum: Decimal;
    aprCap: Decimal;
    count: number;
  }>();

  for (const a of accruals) {
    const mId = a.position.market.marketId;
    const existing = byMarket.get(mId) || {
      marketId: mId,
      marketName: a.position.market.name,
      loanAsset: a.position.market.loanAsset,
      totalExcess: new Decimal(0),
      aprSum: new Decimal(0),
      aprCap: new Decimal(a.position.market.aprCap.toString()),
      count: 0,
    };

    existing.totalExcess = existing.totalExcess.add(new Decimal(a.excessAmt.toString()));
    existing.aprSum = existing.aprSum.add(new Decimal(a.actualApr.toString()));
    existing.count++;
    byMarket.set(mId, existing);
  }

  // Get prices
  const loanAssets = [...new Set(Array.from(byMarket.values()).map(m => m.loanAsset))];
  let prices = getCachedPrices();
  if (loanAssets.length > 0) {
    try {
      prices = await fetchTokenPrices(loanAssets);
    } catch {
      // fall back to cached
    }
  }

  const results = Array.from(byMarket.values()).map(m => {
    const decimals = TOKEN_DECIMALS[m.loanAsset] || 18;
    const price = prices[m.loanAsset] || 1;
    const humanExcess = m.totalExcess.div(new Decimal(10).pow(decimals));
    const totalExcessUsd = humanExcess.mul(price);
    const avgActualApr = m.count > 0 ? m.aprSum.div(m.count) : new Decimal(0);
    const aboveCapPct = m.aprCap.gt(0) ? avgActualApr.sub(m.aprCap).div(m.aprCap).mul(100) : new Decimal(0);

    return {
      marketId: m.marketId,
      marketName: m.marketName,
      totalExcessUsd: totalExcessUsd.toFixed(2),
      avgActualApr: avgActualApr.toFixed(4),
      capApr: m.aprCap.toFixed(4),
      aboveCapPct: aboveCapPct.toFixed(2),
    };
  });

  results.sort((a, b) => parseFloat(b.totalExcessUsd) - parseFloat(a.totalExcessUsd));

  res.json(results);
}));

/**
 * GET /api/analytics/borrow-volume?days=30
 * Borrow volume time series by market
 */
router.get('/borrow-volume', asyncHandler(async (req: Request, res: Response) => {
  const days = Math.min(parseInt(req.query.days as string) || 30, 365);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const snapshots = await prisma.dailySnapshot.findMany({
    where: { date: { gte: startDate } },
    include: { market: { select: { marketId: true, name: true, loanAsset: true } } },
    orderBy: { date: 'asc' },
  });

  // Get prices
  const loanAssets = [...new Set(snapshots.map(s => s.market.loanAsset))];
  let prices = getCachedPrices();
  if (loanAssets.length > 0) {
    try {
      prices = await fetchTokenPrices(loanAssets);
    } catch {
      // fall back to cached
    }
  }

  // Group by market
  const seriesMap = new Map<string, {
    marketId: string;
    marketName: string;
    data: { date: string; totalBorrowedUsd: string }[];
  }>();

  for (const s of snapshots) {
    const mId = s.market.marketId;
    const decimals = TOKEN_DECIMALS[s.market.loanAsset] || 18;
    const price = prices[s.market.loanAsset] || 1;
    const humanBorrowed = new Decimal(s.totalBorrowed.toString()).div(new Decimal(10).pow(decimals));
    const usdBorrowed = humanBorrowed.mul(price);

    const entry = seriesMap.get(mId) || {
      marketId: mId,
      marketName: s.market.name,
      data: [],
    };

    entry.data.push({
      date: s.date.toISOString().split('T')[0],
      totalBorrowedUsd: usdBorrowed.toFixed(2),
    });

    seriesMap.set(mId, entry);
  }

  res.json({ series: Array.from(seriesMap.values()) });
}));

export default router;
