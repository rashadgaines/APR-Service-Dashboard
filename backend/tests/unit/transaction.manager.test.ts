import { Decimal } from 'decimal.js';

// Mock viem
const mockSendTransaction = jest.fn();
const mockWaitForTransactionReceipt = jest.fn();
const mockEstimateGas = jest.fn();
const mockGetGasPrice = jest.fn();
const mockGetTransactionCount = jest.fn();
const mockReadContract = jest.fn();

jest.mock('@/services/blockchain/wallet', () => ({
  getWalletClient: () => ({
    account: { address: '0x1234567890123456789012345678901234567890' },
    chain: { id: 137 },
    sendTransaction: mockSendTransaction,
  }),
  getPublicClient: () => ({
    estimateGas: mockEstimateGas,
    getGasPrice: mockGetGasPrice,
    getTransactionCount: mockGetTransactionCount,
    waitForTransactionReceipt: mockWaitForTransactionReceipt,
    readContract: mockReadContract,
  }),
  isWalletReady: () => true,
  getGasPrice: async (multiplier = 1) => {
    const gasPrice = await mockGetGasPrice();
    return BigInt(Math.ceil(Number(gasPrice) * multiplier));
  },
  getCurrentNonce: async () => mockGetTransactionCount(),
  getSignerAddress: () => '0x1234567890123456789012345678901234567890',
}));

jest.mock('@/config/env', () => ({
  env: {
    GAS_PRICE_MULTIPLIER: 1.2,
    TX_CONFIRMATIONS: 2,
    REIMBURSEMENT_ENABLED: true,
  },
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
import {
  executeTokenTransfer,
  getTokenBalance,
  getTokenDecimals,
  hasSufficientBalance,
} from '@/services/blockchain/transactionManager';

describe('Transaction Manager', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default successful mocks
    mockGetGasPrice.mockResolvedValue(30000000000n); // 30 gwei
    mockEstimateGas.mockResolvedValue(65000n);
    mockGetTransactionCount.mockResolvedValue(42);
    mockSendTransaction.mockResolvedValue('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab');
    mockWaitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      blockNumber: 12345678n,
      gasUsed: 55000n,
      effectiveGasPrice: 30000000000n,
    });
  });

  describe('executeTokenTransfer', () => {
    const transferParams = {
      tokenAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`,
      recipientAddress: '0x9876543210987654321098765432109876543210' as `0x${string}`,
      amount: 1000000000000000000n, // 1 ETH
    };

    it('successfully executes a token transfer', async () => {
      const result = await executeTokenTransfer(transferParams);

      expect(result.success).toBe(true);
      expect(result.hash).toBe('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab');
      expect(result.receipt).toBeDefined();
      expect(result.receipt?.status).toBe('success');
      expect(result.gasUsed).toBe(55000n);
    });

    it('returns failure when transaction reverts', async () => {
      mockWaitForTransactionReceipt.mockResolvedValue({
        status: 'reverted',
        blockNumber: 12345678n,
        gasUsed: 21000n,
      });

      const result = await executeTokenTransfer(transferParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction reverted');
    });

    it('retries on temporary failure', async () => {
      mockSendTransaction
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce('0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab');

      const result = await executeTokenTransfer(transferParams);

      expect(result.success).toBe(true);
      expect(mockSendTransaction).toHaveBeenCalledTimes(2);
    });

    it('stops retrying on insufficient funds error', async () => {
      mockSendTransaction.mockRejectedValue(new Error('insufficient funds for gas'));

      const result = await executeTokenTransfer(transferParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('insufficient funds');
      expect(mockSendTransaction).toHaveBeenCalledTimes(1);
    });

    it('includes gas buffer in transaction', async () => {
      await executeTokenTransfer(transferParams);

      // Verify gas limit includes buffer (65000 * 1.2 = 78000)
      expect(mockSendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          gas: 78000n,
        })
      );
    });
  });

  describe('getTokenBalance', () => {
    it('returns the token balance for an address', async () => {
      mockReadContract.mockResolvedValue(5000000000000000000n); // 5 tokens

      const balance = await getTokenBalance(
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`,
        '0x1234567890123456789012345678901234567890' as `0x${string}`
      );

      expect(balance).toBe(5000000000000000000n);
    });
  });

  describe('getTokenDecimals', () => {
    it('returns the token decimals', async () => {
      mockReadContract.mockResolvedValue(18);

      const decimals = await getTokenDecimals(
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`
      );

      expect(decimals).toBe(18);
    });
  });

  describe('hasSufficientBalance', () => {
    it('returns true when balance is sufficient', async () => {
      mockReadContract.mockResolvedValue(5000000000000000000n);

      const result = await hasSufficientBalance(
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`,
        1000000000000000000n
      );

      expect(result.sufficient).toBe(true);
      expect(result.balance).toBe(5000000000000000000n);
    });

    it('returns false when balance is insufficient', async () => {
      mockReadContract.mockResolvedValue(500000000000000000n);

      const result = await hasSufficientBalance(
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' as `0x${string}`,
        1000000000000000000n
      );

      expect(result.sufficient).toBe(false);
    });
  });
});
