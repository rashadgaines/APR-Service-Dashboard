// Test setup file
import { Decimal } from 'decimal.js';

// Configure Decimal.js for consistent precision
Decimal.set({ precision: 50, rounding: 4 });

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.POLYGON_RPC_URL = 'https://polygon-rpc.com';
process.env.LOG_LEVEL = 'error';
process.env.REIMBURSEMENT_ENABLED = 'false';

// Extend global types
declare global {
  // eslint-disable-next-line no-var, @typescript-eslint/no-explicit-any
  var testUtils: any;
}

// Test utilities
const testUtilities = {
  // Helper to create mock positions
  createMockPosition: (overrides: Record<string, any> = {}) => ({
    id: `position-${Math.random().toString(36).substr(2, 9)}`,
    borrowerId: 'borrower-1',
    marketId: 'market-1',
    principal: new Decimal('1000000000000000000'), // 1 ETH in wei
    collateral: new Decimal('1500000000000000000'),
    isActive: true,
    openedAt: new Date(),
    closedAt: null,
    updatedAt: new Date(),
    ...overrides,
  }),

  // Helper to create mock market
  createMockMarket: (overrides: Record<string, any> = {}) => ({
    id: `market-${Math.random().toString(36).substr(2, 9)}`,
    marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
    vaultAddress: '0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF',
    name: 'wstETH/WETH',
    collateralAsset: 'wstETH',
    loanAsset: 'WETH',
    lltv: new Decimal('0.915'),
    aprCap: new Decimal('8'), // 8%
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Helper to create mock borrower
  createMockBorrower: (overrides: Record<string, any> = {}) => ({
    id: `borrower-${Math.random().toString(36).substr(2, 9)}`,
    address: `0x${Math.random().toString(16).substr(2, 40)}`,
    createdAt: new Date(),
    ...overrides,
  }),

  // Helper to create mock interest accrual
  createMockAccrual: (overrides: Record<string, any> = {}) => ({
    id: `accrual-${Math.random().toString(36).substr(2, 9)}`,
    positionId: 'position-1',
    date: new Date(),
    accruedAmt: new Decimal('1000000000000000'), // 0.001 ETH
    actualApr: new Decimal('0.12'), // 12%
    cappedApr: new Decimal('0.08'), // 8%
    excessAmt: new Decimal('333333333333333'), // excess amount
    ...overrides,
  }),

  // Helper to create mock reimbursement
  createMockReimbursement: (overrides: Record<string, any> = {}) => ({
    id: `reimbursement-${Math.random().toString(36).substr(2, 9)}`,
    positionId: 'position-1',
    date: new Date(),
    amount: new Decimal('333333333333333'),
    txHash: `0x${Math.random().toString(16).substr(2, 64)}`,
    status: 'processed',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Helper to create mock alert
  createMockAlert: (overrides: Record<string, any> = {}) => ({
    id: `alert-${Math.random().toString(36).substr(2, 9)}`,
    type: 'HIGH_APR',
    severity: 'critical',
    message: 'Test alert message',
    marketId: null,
    marketName: null,
    borrowerAddress: null,
    metadata: {},
    acknowledged: false,
    acknowledgedAt: null,
    acknowledgedBy: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  // Helper to create Prisma mock
  createPrismaMock: () => ({
    market: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    borrower: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    position: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    interestAccrual: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
    reimbursement: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    alert: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    dailySnapshot: {
      findMany: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
    },
    $transaction: jest.fn((callback: (tx: any) => Promise<any>) => callback({
      market: { findMany: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
      borrower: { upsert: jest.fn() },
      position: { create: jest.fn(), update: jest.fn(), findFirst: jest.fn() },
      interestAccrual: { create: jest.fn(), findMany: jest.fn() },
      reimbursement: { create: jest.fn() },
    })),
  }),

  // Helper to wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
};

global.testUtils = testUtilities;
