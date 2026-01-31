import { Decimal } from 'decimal.js';

// Mock all dependencies before importing
const mockPrisma = {
  interestAccrual: {
    findMany: jest.fn(),
  },
  reimbursement: {
    findMany: jest.fn(),
    create: jest.fn(),
    groupBy: jest.fn(),
  },
  $transaction: jest.fn((callback: (tx: any) => Promise<any>) => callback({
    reimbursement: {
      create: jest.fn().mockResolvedValue({}),
    },
  })),
};

const mockIsWalletReady = jest.fn();

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/config/env', () => ({
  env: {
    REIMBURSEMENT_ENABLED: false,
    NODE_ENV: 'test',
  },
}));

const mockExecuteTokenTransfer = jest.fn();

jest.mock('@/services/blockchain', () => ({
  executeTokenTransfer: mockExecuteTokenTransfer,
  isWalletReady: mockIsWalletReady,
}));

jest.mock('@/services/prices/fetcher', () => ({
  fetchTokenPrices: jest.fn().mockResolvedValue({ WETH: 3000, USDC: 1 }),
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
import { processReimbursements, getReimbursementHistory, getDailyReimbursementTotals } from '@/services/reimbursement/processor';

describe('Reimbursement Processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrisma.interestAccrual.findMany.mockResolvedValue([]);
    mockPrisma.reimbursement.findMany.mockResolvedValue([]);
    // Default to wallet ready for tests that need processing
    mockIsWalletReady.mockReturnValue(true);
    // Default successful transfer mock
    mockExecuteTokenTransfer.mockResolvedValue({
      success: true,
      hash: '0xmocktxhash123',
      gasUsed: 21000n,
    });
  });

  describe('processReimbursements', () => {
    it('returns empty result when no pending accruals', async () => {
      mockPrisma.interestAccrual.findMany.mockResolvedValue([]);

      const result = await processReimbursements();

      expect(result.borrowersProcessed).toBe(0);
      expect(result.totalReimbursed.toString()).toBe('0');
      expect(result.transactionsCreated).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('processes pending accruals with excess amount', async () => {
      const mockAccruals = [
        {
          id: 'accrual-1',
          positionId: 'position-1',
          date: new Date('2024-01-01'),
          excessAmt: new Decimal('100'),
          position: {
            id: 'position-1',
            borrower: { address: '0xborrower1' },
            market: { loanAsset: 'WETH', name: 'wstETH/WETH' },
          },
        },
        {
          id: 'accrual-2',
          positionId: 'position-2',
          date: new Date('2024-01-01'),
          excessAmt: new Decimal('50'),
          position: {
            id: 'position-2',
            borrower: { address: '0xborrower2' },
            market: { loanAsset: 'USDC', name: 'WBTC/USDC' },
          },
        },
      ];

      mockPrisma.interestAccrual.findMany.mockResolvedValue(mockAccruals);
      mockPrisma.reimbursement.findMany.mockResolvedValue([]);

      const result = await processReimbursements();

      // In mock mode, both should be processed
      expect(result.borrowersProcessed).toBe(2);
      expect(result.totalReimbursed.toString()).toBe('150');
      expect(result.transactionsCreated).toBe(2);
      expect(result.errors).toHaveLength(0);
    });

    it('skips already reimbursed accruals', async () => {
      const mockAccruals = [
        {
          id: 'accrual-1',
          positionId: 'position-1',
          date: new Date('2024-01-01'),
          excessAmt: new Decimal('100'),
          position: {
            id: 'position-1',
            borrower: { address: '0xborrower1' },
            market: { loanAsset: 'WETH', name: 'wstETH/WETH' },
          },
        },
      ];

      // This reimbursement already exists
      const existingReimbursements = [
        { positionId: 'position-1', date: new Date('2024-01-01') },
      ];

      mockPrisma.interestAccrual.findMany.mockResolvedValue(mockAccruals);
      mockPrisma.reimbursement.findMany.mockResolvedValue(existingReimbursements);

      const result = await processReimbursements();

      // Should be skipped because already reimbursed
      expect(result.borrowersProcessed).toBe(0);
      expect(result.totalReimbursed.toString()).toBe('0');
      expect(result.transactionsCreated).toBe(0);
    });

    it('groups accruals by borrower and loan asset', async () => {
      const mockAccruals = [
        {
          id: 'accrual-1',
          positionId: 'position-1',
          date: new Date('2024-01-01'),
          excessAmt: new Decimal('100'),
          position: {
            id: 'position-1',
            borrower: { address: '0xborrower1' },
            market: { loanAsset: 'WETH', name: 'wstETH/WETH' },
          },
        },
        {
          id: 'accrual-2',
          positionId: 'position-2',
          date: new Date('2024-01-01'),
          excessAmt: new Decimal('50'),
          position: {
            id: 'position-2',
            borrower: { address: '0xborrower1' }, // Same borrower
            market: { loanAsset: 'WETH', name: 'wstETH/WETH' }, // Same loan asset
          },
        },
      ];

      mockPrisma.interestAccrual.findMany.mockResolvedValue(mockAccruals);
      mockPrisma.reimbursement.findMany.mockResolvedValue([]);

      const result = await processReimbursements();

      // Should be grouped into single transaction
      expect(result.borrowersProcessed).toBe(1);
      expect(result.totalReimbursed.toString()).toBe('150');
      expect(result.transactionsCreated).toBe(1); // One tx for combined amount
    });

    it('handles zero excess amounts gracefully', async () => {
      const mockAccruals = [
        {
          id: 'accrual-1',
          positionId: 'position-1',
          date: new Date('2024-01-01'),
          excessAmt: new Decimal('0'), // Zero excess
          position: {
            id: 'position-1',
            borrower: { address: '0xborrower1' },
            market: { loanAsset: 'WETH', name: 'wstETH/WETH' },
          },
        },
      ];

      mockPrisma.interestAccrual.findMany.mockResolvedValue(mockAccruals);
      mockPrisma.reimbursement.findMany.mockResolvedValue([]);

      const result = await processReimbursements();

      // Should process but with zero total
      expect(result.totalReimbursed.toString()).toBe('0');
    });
  });

  describe('getReimbursementHistory', () => {
    it('returns formatted reimbursement history', async () => {
      const mockReimbursements = [
        {
          id: 'reimb-1',
          positionId: 'position-1',
          date: new Date('2024-01-15'),
          amount: new Decimal('100'),
          txHash: '0xabc123',
          status: 'processed',
          createdAt: new Date(),
          position: {
            borrower: { address: '0xborrower1' },
            market: { name: 'wstETH/WETH', marketId: 'market-1' },
          },
        },
      ];

      mockPrisma.reimbursement.findMany.mockResolvedValue(mockReimbursements);

      const history = await getReimbursementHistory();

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        id: 'reimb-1',
        borrowerAddress: '0xborrower1',
        marketName: 'wstETH/WETH',
        txHash: '0xabc123',
        status: 'processed',
      });
    });

    it('applies filters correctly', async () => {
      mockPrisma.reimbursement.findMany.mockResolvedValue([]);

      await getReimbursementHistory({
        borrowerAddress: '0xborrower1',
        status: 'processed',
        limit: 10,
        offset: 20,
      });

      expect(mockPrisma.reimbursement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
          where: expect.objectContaining({
            status: 'processed',
          }),
        })
      );
    });
  });

  describe('getDailyReimbursementTotals', () => {
    it('returns daily totals for charting', async () => {
      // The implementation now uses findMany and processes in JS
      const mockReimbursements = [
        {
          id: 'reimb-1',
          date: new Date('2024-01-15'),
          amount: new Decimal('500000000000000000'), // 0.5 WETH in wei
          status: 'processed',
          position: {
            market: { loanAsset: 'WETH' },
          },
        },
        {
          id: 'reimb-2',
          date: new Date('2024-01-15'),
          amount: new Decimal('300000000000000000'), // 0.3 WETH in wei
          status: 'processed',
          position: {
            market: { loanAsset: 'WETH' },
          },
        },
        {
          id: 'reimb-3',
          date: new Date('2024-01-16'),
          amount: new Decimal('200000000000000000'), // 0.2 WETH in wei
          status: 'processed',
          position: {
            market: { loanAsset: 'WETH' },
          },
        },
      ];

      mockPrisma.reimbursement.findMany.mockResolvedValue(mockReimbursements);

      const totals = await getDailyReimbursementTotals(7);

      expect(totals).toHaveLength(2);
      // First day: 0.5 + 0.3 = 0.8 WETH * $3000 = $2400, 2 reimbursements
      expect(totals[0]).toMatchObject({
        date: '2024-01-15',
        count: 2,
      });
      // Second day: 0.2 WETH * $3000 = $600, 1 reimbursement
      expect(totals[1]).toMatchObject({
        date: '2024-01-16',
        count: 1,
      });
    });
  });
});
