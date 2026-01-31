import express, { Express } from 'express';
import { Decimal } from 'decimal.js';

// Mock dependencies before importing routes
const mockPrisma = {
  borrower: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  position: {
    count: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
  },
  market: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  alert: {
    count: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  reimbursement: {
    count: jest.fn(),
    findMany: jest.fn(),
    aggregate: jest.fn(),
  },
  interestAccrual: {
    findMany: jest.fn(),
  },
  dailySnapshot: {
    findMany: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/services/morpho/queries', () => ({
  getMarketAPR: jest.fn().mockResolvedValue(800), // 8% in bps
  getAllActivePositions: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/services/morpho/client', () => ({
  polygonClient: {
    getBlockNumber: jest.fn().mockResolvedValue(50000000n),
  },
}));

jest.mock('@/services/blockchain', () => ({
  isWalletReady: jest.fn().mockReturnValue(true),
  getSignerAddress: jest.fn().mockReturnValue('0xTestWalletAddress'),
  getWalletBalance: jest.fn().mockResolvedValue(1000000000000000000n), // 1 POL
}));

jest.mock('@/services/prices/fetcher', () => ({
  fetchTokenPrices: jest.fn().mockResolvedValue({ WETH: 3000, USDC: 1, USDT: 1 }),
  getCachedPrices: jest.fn().mockReturnValue({ WETH: 3000, USDC: 1, USDT: 1 }),
  getAllFallbackPrices: jest.fn().mockReturnValue({ WETH: 3000, USDC: 1, USDT: 1 }),
}));

jest.mock('@/services/reimbursement/processor', () => ({
  getDailyReimbursementTotals: jest.fn().mockResolvedValue([
    { date: '2024-01-15', amount: new Decimal('1500.00'), count: 5 },
    { date: '2024-01-16', amount: new Decimal('2200.00'), count: 8 },
  ]),
  processReimbursements: jest.fn().mockResolvedValue({
    borrowersProcessed: 0,
    totalReimbursed: new Decimal(0),
    transactionsCreated: 0,
    errors: [],
  }),
  getReimbursementHistory: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import routes after mocking
import metricsRoutes from '@/api/routes/metrics';
import marketRoutes from '@/api/routes/markets';
import alertRoutes from '@/api/routes/alerts';
import healthRoutes from '@/api/routes/health';
import { errorHandler } from '@/api/middleware/error';

// Create test app
function createTestApp(): Express {
  const app = express();
  app.use(express.json());

  app.use('/api/metrics', metricsRoutes);
  app.use('/api/markets', marketRoutes);
  app.use('/api/alerts', alertRoutes);
  app.use('/api/health', healthRoutes);

  app.use(errorHandler);

  return app;
}

// Simple request helper (no external deps like supertest needed)
async function request(app: Express, method: string, path: string, body?: any): Promise<{
  status: number;
  body: any;
}> {
  return new Promise((resolve) => {
    const req: any = {
      method,
      path,
      url: path,
      headers: {},
      get: (key: string) => req.headers[key.toLowerCase()],
      body: body || {},
      params: {},
      query: {},
    };

    // Extract params from path (simple implementation)
    const pathParts = path.split('/');

    const res: any = {
      statusCode: 200,
      headers: {},
      body: null,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(data: any) {
        this.body = data;
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      send(data: any) {
        this.body = data;
        resolve({ status: this.statusCode, body: data });
        return this;
      },
      setHeader(key: string, value: string) {
        this.headers[key] = value;
        return this;
      },
    };

    // Route the request through Express
    app(req, res, () => {
      resolve({ status: res.statusCode, body: res.body });
    });
  });
}

describe('API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    mockPrisma.borrower.count.mockResolvedValue(10);
    mockPrisma.position.count.mockResolvedValue(25);
    mockPrisma.position.groupBy.mockResolvedValue([
      { borrowerId: '1', _count: 1 },
      { borrowerId: '2', _count: 2 },
    ]);
    mockPrisma.position.findMany.mockResolvedValue([]);
    mockPrisma.market.count.mockResolvedValue(3);
    mockPrisma.market.findMany.mockResolvedValue([]);
    mockPrisma.alert.count.mockResolvedValue(2);
    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.reimbursement.findMany.mockResolvedValue([]);
    mockPrisma.interestAccrual.findMany.mockResolvedValue([]);
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  describe('GET /api/metrics/overview', () => {
    it('returns overview metrics structure', async () => {
      const res = await request(app, 'GET', '/api/metrics/overview');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalBorrowers');
      expect(res.body).toHaveProperty('activeBorrowers');
      expect(res.body).toHaveProperty('borrowersUnderCap');
      expect(res.body).toHaveProperty('borrowersAboveCap');
      expect(res.body).toHaveProperty('totalValueLocked');
      expect(res.body).toHaveProperty('todayReimbursements');
      expect(res.body).toHaveProperty('totalReimbursements');
    });

    it('handles database errors gracefully', async () => {
      mockPrisma.borrower.count.mockRejectedValue(new Error('DB Error'));
      mockPrisma.position.groupBy.mockRejectedValue(new Error('DB Error'));
      mockPrisma.position.findMany.mockRejectedValue(new Error('DB Error'));
      mockPrisma.reimbursement.findMany.mockRejectedValue(new Error('DB Error'));

      const res = await request(app, 'GET', '/api/metrics/overview');

      // Should return 200 with default values on error (graceful degradation)
      expect(res.status).toBe(200);
      // The metrics endpoint returns defaults on error
      expect(res.body).toHaveProperty('totalBorrowers');
    });
  });

  describe('GET /api/metrics/daily', () => {
    it('returns daily reimbursement data', async () => {
      const res = await request(app, 'GET', '/api/metrics/daily');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/metrics/markets', () => {
    it('returns market metrics', async () => {
      mockPrisma.market.findMany.mockResolvedValue([
        {
          marketId: '0xtest123',
          name: 'Test Market',
          loanAsset: 'WETH',
          positions: [],
          dailySnapshots: [
            {
              totalBorrowed: new Decimal('1000000000000000000'),
              borrowerCount: 5,
              aboveCapCount: 2,
            },
          ],
        },
      ]);

      const res = await request(app, 'GET', '/api/metrics/markets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
      expect(Array.isArray(res.body.markets)).toBe(true);
    });
  });

  describe('GET /api/markets', () => {
    it('returns list of markets', async () => {
      mockPrisma.market.findMany.mockResolvedValue([
        {
          marketId: '0xtest123',
          name: 'wstETH/WETH',
          collateralAsset: 'wstETH',
          loanAsset: 'WETH',
          lltv: new Decimal('0.915'),
          aprCap: new Decimal('8'),
          positions: [],
          _count: { positions: 5 },
          dailySnapshots: [],
        },
      ]);

      const res = await request(app, 'GET', '/api/markets');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('markets');
    });

    it('handles empty markets gracefully', async () => {
      mockPrisma.market.findMany.mockResolvedValue([]);

      const res = await request(app, 'GET', '/api/markets');

      expect(res.status).toBe(200);
      expect(res.body.markets).toEqual([]);
    });
  });

  describe('GET /api/alerts', () => {
    it('returns list of alerts', async () => {
      mockPrisma.alert.findMany.mockResolvedValue([
        {
          id: 'alert-1',
          type: 'HIGH_APR',
          severity: 'critical',
          message: 'APR exceeded 2x cap',
          acknowledged: false,
          createdAt: new Date(),
        },
      ]);

      const res = await request(app, 'GET', '/api/alerts');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('alerts');
      expect(Array.isArray(res.body.alerts)).toBe(true);
    });
  });

  describe('GET /api/health', () => {
    it('returns comprehensive health status', async () => {
      const res = await request(app, 'GET', '/api/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('version');
      expect(res.body).toHaveProperty('uptime');
      expect(res.body).toHaveProperty('checks');
      expect(res.body.checks).toHaveProperty('database');
      expect(res.body.checks).toHaveProperty('polygonRpc');
      expect(res.body.checks).toHaveProperty('wallet');
    });

    it('returns healthy status when all services are up', async () => {
      const res = await request(app, 'GET', '/api/health');

      expect(res.body.status).toBe('healthy');
      expect(res.body.checks.database.status).toBe('ok');
    });
  });

  describe('GET /api/health/ready', () => {
    it('returns ready when database is accessible', async () => {
      const res = await request(app, 'GET', '/api/health/ready');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ready: true });
    });

    it('returns not ready when database fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB Error'));

      const res = await request(app, 'GET', '/api/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
    });
  });

  describe('GET /api/health/live', () => {
    it('returns alive status', async () => {
      const res = await request(app, 'GET', '/api/health/live');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ alive: true });
    });
  });
});

describe('API Error Handling', () => {
  let app: Express;

  beforeAll(() => {
    app = createTestApp();
  });

  it('handles unexpected errors gracefully', async () => {
    mockPrisma.market.findMany.mockRejectedValue(new Error('Unexpected error'));

    const res = await request(app, 'GET', '/api/markets');

    // Should return 503 Service Unavailable
    expect(res.status).toBe(503);
    expect(res.body).toHaveProperty('error');
  });
});
