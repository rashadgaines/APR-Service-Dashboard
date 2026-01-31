import { Router, Request, Response } from 'express';
import { prisma } from '@/config/database';
import { polygonClient } from '@/services/morpho/client';
import { isWalletReady, getSignerAddress, getWalletBalance } from '@/services/blockchain';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

const router = Router();

interface HealthCheck {
  status: 'ok' | 'error';
  latency?: number;
  error?: string;
  details?: Record<string, any>;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    polygonRpc: HealthCheck;
    wallet: HealthCheck;
  };
}

const startTime = Date.now();

/**
 * GET /api/health
 * Comprehensive health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const checks: HealthResponse['checks'] = {
    database: await checkDatabase(),
    polygonRpc: await checkPolygonRpc(),
    wallet: await checkWallet(),
  };

  const allOk = Object.values(checks).every((c) => c.status === 'ok');
  const anyError = Object.values(checks).some((c) => c.status === 'error');

  const status: HealthResponse['status'] = allOk
    ? 'healthy'
    : anyError
    ? 'unhealthy'
    : 'degraded';

  const response: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };

  const httpStatus = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
  res.status(httpStatus).json(response);
});

/**
 * GET /api/health/ready
 * Readiness probe (are we ready to serve traffic?)
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    // Check if database is accessible
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ ready: true });
  } catch (error) {
    res.status(503).json({ ready: false, error: 'Database not accessible' });
  }
});

/**
 * GET /api/health/live
 * Liveness probe (is the process running?)
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({ alive: true });
});

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;

    // Also check table counts for basic integrity
    const [marketCount, positionCount, alertCount] = await Promise.all([
      prisma.market.count(),
      prisma.position.count(),
      prisma.alert.count(),
    ]);

    return {
      status: 'ok',
      latency,
      details: {
        markets: marketCount,
        positions: positionCount,
        alerts: alertCount,
      },
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkPolygonRpc(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const blockNumber = await polygonClient.getBlockNumber();
    const latency = Date.now() - start;

    return {
      status: 'ok',
      latency,
      details: {
        blockNumber: blockNumber.toString(),
        chain: 'polygon',
      },
    };
  } catch (error) {
    logger.error('Polygon RPC health check failed:', error);
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkWallet(): Promise<HealthCheck> {
  const start = Date.now();

  if (!isWalletReady()) {
    return {
      status: 'error',
      latency: Date.now() - start,
      error: 'Wallet not initialized - PRIVATE_KEY must be set for on-chain reimbursements',
    };
  }

  try {
    const address = getSignerAddress();
    const balance = await getWalletBalance();
    const latency = Date.now() - start;

    // Warn if balance is low (< 0.1 POL)
    const lowBalance = balance < 100000000000000000n; // 0.1 POL

    return {
      status: lowBalance ? 'ok' : 'ok', // Still ok, but with warning in details
      latency,
      details: {
        enabled: true,
        address,
        balanceWei: balance.toString(),
        balancePol: Number(balance) / 1e18,
        lowBalance,
      },
    };
  } catch (error) {
    logger.error('Wallet health check failed:', error);
    return {
      status: 'error',
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default router;
