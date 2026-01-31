import type { AlertsResponse, DailyReimbursementData, MarketMetrics, MetricsOverview, Market, Alert, Reimbursement } from '@/types';

const today = new Date();

function formatDate(date: Date) {
  return date.toISOString().split('T')[0];
}

function daysAgo(days: number) {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  return d;
}

function buildDaily(days = 30): { data: DailyReimbursementData[] } {
  const data: DailyReimbursementData[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const base = 8000 + (i % 7) * 1200;
    const variance = Math.sin(i / 3) * 900;
    const amount = Math.max(1200, base + variance);
    const count = Math.max(1, Math.round(amount / 1500));
    data.push({
      date: formatDate(daysAgo(i)),
      amount: amount.toFixed(2),
      count,
    });
  }
  return { data };
}

export const mockOverview: MetricsOverview = {
  totalBorrowers: 186,
  activeBorrowers: 142,
  borrowersUnderCap: 134,
  borrowersAboveCap: 8,
  totalValueLocked: '24580000.00',
  todayReimbursements: '18450.23',
  totalReimbursements: '428900.12',
};

export const mockMarketMetrics: MarketMetrics = {
  markets: [
    {
      id: 'market-wsteth-weth',
      name: 'wstETH/WETH',
      totalBorrowed: '12500000.00',
      borrowerCount: 58,
      aboveCapCount: 2,
      utilizationRate: '76.4',
    },
    {
      id: 'market-wbtc-usdc',
      name: 'WBTC/USDC',
      totalBorrowed: '8420000.00',
      borrowerCount: 44,
      aboveCapCount: 1,
      utilizationRate: '68.9',
    },
    {
      id: 'market-wpol-usdc',
      name: 'WPOL/USDC',
      totalBorrowed: '3760000.00',
      borrowerCount: 40,
      aboveCapCount: 0,
      utilizationRate: '55.1',
    },
  ],
};

export const mockMarkets: Market[] = [
  {
    id: 'market-wsteth-weth',
    marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
    name: 'wstETH/WETH',
    collateralAsset: 'wstETH',
    loanAsset: 'WETH',
    lltv: '0.915',
    aprCap: '8',
    borrowerCount: 58,
    totalBorrowed: '12500000.00',
    aboveCapCount: 2,
  },
  {
    id: 'market-wbtc-usdc',
    marketId: '0xf3c12c9f8d6f91b3248ac67339a7e00d5f9b5be4f5bbcf2c01e2f5b9f3a8a1c2',
    name: 'WBTC/USDC',
    collateralAsset: 'WBTC',
    loanAsset: 'USDC',
    lltv: '0.86',
    aprCap: '10',
    borrowerCount: 44,
    totalBorrowed: '8420000.00',
    aboveCapCount: 1,
  },
  {
    id: 'market-wpol-usdc',
    marketId: '0x2f2b4a52b40a6a49e6b40c69e2a6a624e2a2a2a2a2a2a2a2a2a2a2a2a2a2a2a2',
    name: 'WPOL/USDC',
    collateralAsset: 'WPOL',
    loanAsset: 'USDC',
    lltv: '0.77',
    aprCap: '12',
    borrowerCount: 40,
    totalBorrowed: '3760000.00',
    aboveCapCount: 0,
  },
];

export const mockAlerts: AlertsResponse = {
  alerts: [
    {
      id: 'alert-1',
      type: 'HIGH_APR',
      severity: 'critical',
      message: 'APR exceeded cap on wstETH/WETH by 3.2% (11.2% vs 8%)',
      marketId: mockMarkets[0].id,
      timestamp: new Date().toISOString(),
      acknowledged: false,
    },
    {
      id: 'alert-2',
      type: 'REIMBURSEMENT_SPIKE',
      severity: 'warning',
      message: 'Reimbursement spike detected: +42% day-over-day',
      timestamp: daysAgo(1).toISOString(),
      acknowledged: false,
    },
    {
      id: 'alert-3',
      type: 'SYNC_FAILURE',
      severity: 'info',
      message: 'Morpho position sync took longer than expected (5.4s)',
      timestamp: daysAgo(2).toISOString(),
      acknowledged: true,
    },
  ],
  total: 3,
  breakdown: {
    critical: 1,
    warning: 1,
    info: 1,
  },
};

const mockAlertHistory: Alert[] = [
  {
    id: 'alert-1',
    type: 'HIGH_APR',
    severity: 'critical',
    message: 'APR exceeded cap on wstETH/WETH by 3.2% (11.2% vs 8%)',
    marketId: mockMarkets[0].id,
    timestamp: new Date().toISOString(),
    acknowledged: false,
  },
  {
    id: 'alert-2',
    type: 'REIMBURSEMENT_SPIKE',
    severity: 'warning',
    message: 'Reimbursement spike detected: +42% day-over-day',
    timestamp: daysAgo(1).toISOString(),
    acknowledged: true,
  },
  {
    id: 'alert-3',
    type: 'SYNC_FAILURE',
    severity: 'info',
    message: 'Morpho position sync took longer than expected (5.4s)',
    timestamp: daysAgo(2).toISOString(),
    acknowledged: true,
  },
];

const mockReimbursements: Reimbursement[] = Array.from({ length: 25 }).map((_, idx) => {
  const market = mockMarkets[idx % mockMarkets.length];
  const amount = 150 + (idx % 6) * 75 + (idx % 3) * 22;
  return {
    id: `reim-${idx + 1}`,
    positionId: `pos-${idx + 100}`,
    borrowerAddress: `0x${(idx + 10).toString().padStart(40, '0')}`,
    marketName: market.name,
    date: daysAgo(idx % 12).toISOString(),
    amount: amount.toFixed(2),
    txHash: idx % 5 === 0 ? null : `0x${(idx + 1000).toString(16).padStart(64, '0')}`,
    status: idx % 7 === 0 ? 'failed' : idx % 4 === 0 ? 'pending' : 'processed',
  };
});

function buildMarketDetail(marketId: string) {
  const market = mockMarkets.find(m => m.id === marketId) || mockMarkets[0];
  return {
    market: {
      ...market,
      vaultAddress: '0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF',
      currentApr: market.id === 'market-wsteth-weth' ? 11.2 : market.id === 'market-wbtc-usdc' ? 9.1 : 7.4,
    },
    positions: [
      {
        id: 'pos-1',
        borrowerAddress: '0x1234567890123456789012345678901234567890',
        principal: '1000000.00',
        collateral: '1500000.00',
        isActive: true,
        openedAt: daysAgo(18).toISOString(),
      },
      {
        id: 'pos-2',
        borrowerAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        principal: '750000.00',
        collateral: '1200000.00',
        isActive: true,
        openedAt: daysAgo(7).toISOString(),
      },
      {
        id: 'pos-3',
        borrowerAddress: '0x9999999999999999999999999999999999999999',
        principal: '420000.00',
        collateral: '680000.00',
        isActive: false,
        openedAt: daysAgo(30).toISOString(),
      },
    ],
    recentSnapshots: Array.from({ length: 7 }).map((_, idx) => ({
      date: formatDate(daysAgo(idx)),
      avgApr: (market.id === 'market-wsteth-weth' ? 10.2 : 8.6 - idx * 0.1).toFixed(2),
      totalBorrowed: (parseFloat(market.totalBorrowed) - idx * 120000).toFixed(2),
      borrowerCount: Math.max(10, market.borrowerCount - idx),
    })),
  };
}

export function getMockResponse(endpoint: string) {
  if (endpoint.startsWith('/metrics/overview')) return mockOverview;
  if (endpoint.startsWith('/metrics/daily')) return buildDaily();
  if (endpoint.startsWith('/metrics/markets')) return mockMarketMetrics;
  if (endpoint.startsWith('/markets/')) {
    const id = endpoint.replace('/markets/', '').split('?')[0];
    return buildMarketDetail(id);
  }
  if (endpoint === '/markets') return { markets: mockMarkets };
  if (endpoint.startsWith('/alerts/history')) {
    return {
      alerts: mockAlertHistory,
      counts: {
        total: mockAlertHistory.length,
        critical: mockAlertHistory.filter(a => a.severity === 'critical').length,
        warning: mockAlertHistory.filter(a => a.severity === 'warning').length,
        info: mockAlertHistory.filter(a => a.severity === 'info').length,
        unacknowledged: mockAlertHistory.filter(a => !a.acknowledged).length,
      },
    };
  }
  if (endpoint.startsWith('/alerts')) return mockAlerts;
  if (endpoint.startsWith('/reimbursements')) return { reimbursements: mockReimbursements };

  return null;
}
