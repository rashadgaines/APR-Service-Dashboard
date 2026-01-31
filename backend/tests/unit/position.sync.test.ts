import { Decimal } from 'decimal.js';

// Import test utilities
const testUtils = (global as any).testUtils;

// Mock dependencies
const mockPrisma = {
  market: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  borrower: {
    upsert: jest.fn(),
  },
  position: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: any) => Promise<any>) => callback({
    market: { upsert: jest.fn().mockResolvedValue({}) },
    borrower: { upsert: jest.fn().mockResolvedValue({ id: 'borrower-1' }) },
    position: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  })),
};

const mockGetAllActivePositions = jest.fn();

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/services/morpho/queries', () => ({
  getAllActivePositions: mockGetAllActivePositions,
  getMarketAPR: jest.fn(),
}));

jest.mock('@/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import after mocking
import { syncPositions, deactivateClosedPositions } from '@/services/sync/positions';

describe('Position Sync Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockPrisma.market.findUnique.mockResolvedValue(
      testUtils.createMockMarket({ id: 'market-1' })
    );
    mockPrisma.market.upsert.mockResolvedValue(
      testUtils.createMockMarket({ id: 'market-1' })
    );
    mockPrisma.borrower.upsert.mockResolvedValue(
      testUtils.createMockBorrower({ id: 'borrower-1' })
    );
    mockPrisma.position.findFirst.mockResolvedValue(null);
    mockPrisma.position.findMany.mockResolvedValue([]);
    mockPrisma.position.create.mockResolvedValue(
      testUtils.createMockPosition({ id: 'position-1' })
    );
  });

  describe('syncPositions', () => {
    it('creates new positions from Morpho data', async () => {
      mockGetAllActivePositions.mockResolvedValue([
        {
          marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
          positions: [
            {
              borrower: '0x1234567890123456789012345678901234567890',
              borrowed: '1000000000000000000',
              collateral: '1500000000000000000',
              isActive: true,
            },
          ],
        },
      ]);

      const result = await syncPositions();

      expect(result.marketsProcessed).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('handles empty market positions', async () => {
      mockGetAllActivePositions.mockResolvedValue([
        {
          marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
          positions: [],
        },
      ]);

      const result = await syncPositions();

      expect(result.positionsCreated).toBe(0);
      expect(result.positionsUpdated).toBe(0);
      expect(result.marketsProcessed).toBe(1);
    });

    it('handles unknown market gracefully', async () => {
      mockGetAllActivePositions.mockResolvedValue([
        {
          marketId: '0xunknownmarket',
          positions: [
            {
              borrower: '0x1234567890123456789012345678901234567890',
              borrowed: '1000000000000000000',
              collateral: '1500000000000000000',
              isActive: true,
            },
          ],
        },
      ]);

      const result = await syncPositions();

      // Should skip unknown market without error
      expect(result.errors).toHaveLength(0);
    });

    it('handles Morpho API failure', async () => {
      mockGetAllActivePositions.mockRejectedValue(new Error('API Error'));

      const result = await syncPositions();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('API Error');
    });

    it('returns correct sync result structure', async () => {
      mockGetAllActivePositions.mockResolvedValue([]);

      const result = await syncPositions();

      expect(result).toHaveProperty('marketsProcessed');
      expect(result).toHaveProperty('positionsCreated');
      expect(result).toHaveProperty('positionsUpdated');
      expect(result).toHaveProperty('errors');
    });
  });

  describe('deactivateClosedPositions', () => {
    it('deactivates positions no longer active on-chain', async () => {
      mockGetAllActivePositions.mockResolvedValue([]);
      mockPrisma.position.findMany.mockResolvedValue([
        { id: 'pos-1', borrowerId: 'b1', marketId: 'm1' },
      ]);

      // Mock transaction to track updateMany call
      const mockUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({ position: { updateMany: mockUpdateMany } });
      });

      const count = await deactivateClosedPositions();

      expect(count).toBe(1);
    });

    it('does nothing when all positions are still active', async () => {
      mockGetAllActivePositions.mockResolvedValue([
        {
          marketId: 'm1',
          positions: [
            { borrower: 'b1', isActive: true },
          ],
        },
      ]);
      mockPrisma.position.findMany.mockResolvedValue([
        { id: 'pos-1', borrowerId: 'b1', marketId: 'm1' },
      ]);

      const count = await deactivateClosedPositions();

      // No positions to deactivate
      expect(count).toBe(0);
    });

    it('handles API failure gracefully', async () => {
      mockGetAllActivePositions.mockRejectedValue(new Error('API Error'));

      const count = await deactivateClosedPositions();

      expect(count).toBe(0);
    });
  });
});
