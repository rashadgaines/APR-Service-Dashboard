import { Decimal } from 'decimal.js';

// Helper to create mock alerts
function createMockAlert(overrides: Record<string, unknown> = {}) {
  return {
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
  };
}

// Mock the dependencies before importing the module
const mockPrisma = {
  reimbursement: {
    aggregate: jest.fn(),
    count: jest.fn(),
  },
  position: {
    findFirst: jest.fn(),
    count: jest.fn(),
  },
  alert: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    count: jest.fn(),
  },
};

const mockGetMarketAPR = jest.fn();

jest.mock('@/config/database', () => ({
  prisma: mockPrisma,
}));

jest.mock('@/services/morpho/queries', () => ({
  getMarketAPR: mockGetMarketAPR,
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
  checkAlerts,
  getStoredAlerts,
  acknowledgeAlert,
  acknowledgeAlerts,
  getAlertCounts,
  getAlertStats,
} from '@/services/alerts/detector';

describe('Alert Detector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementations
    mockGetMarketAPR.mockResolvedValue(500); // 5% APR (below cap)
    mockPrisma.reimbursement.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.reimbursement.count.mockResolvedValue(0);
    mockPrisma.position.findFirst.mockResolvedValue({ id: 'pos-1', updatedAt: new Date() });
    mockPrisma.position.count.mockResolvedValue(1);
    mockPrisma.alert.findFirst.mockResolvedValue(null);
    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.alert.create.mockResolvedValue({ id: 'alert-1' });
    mockPrisma.alert.update.mockResolvedValue({ id: 'alert-1' });
  });

  describe('checkAlerts', () => {
    it('returns empty array when all conditions are normal', async () => {
      const alerts = await checkAlerts();

      // No alerts should be generated when APR is below cap
      // and no other alert conditions are met
      expect(alerts).toEqual([]);
    });

    it('generates HIGH_APR alert when APR is 2x+ above cap', async () => {
      // wstETH/WETH has 8% cap (800 bps)
      // 2x cap = 1600 bps, so set APR to 1800 (above 2x)
      mockGetMarketAPR.mockResolvedValue(1800);

      const alerts = await checkAlerts();

      const highAprAlert = alerts.find(a => a.type === 'HIGH_APR');
      expect(highAprAlert).toBeDefined();
      expect(highAprAlert?.severity).toBe('critical');
      expect(highAprAlert?.message).toContain('above cap');
    });

    it('generates ELEVATED_APR alert when APR is 1.5x-2x above cap', async () => {
      // 1.5x of 800 = 1200, 2x = 1600
      // Set APR to 1300 (between 1.5x and 2x)
      mockGetMarketAPR.mockResolvedValue(1300);

      const alerts = await checkAlerts();

      const elevatedAprAlert = alerts.find(a => a.type === 'ELEVATED_APR');
      expect(elevatedAprAlert).toBeDefined();
      expect(elevatedAprAlert?.severity).toBe('warning');
    });

    it('generates LARGE_REIMBURSEMENT alert when daily reimbursement exceeds threshold', async () => {
      mockPrisma.reimbursement.aggregate.mockResolvedValue({
        _sum: { amount: new Decimal('15000') }, // $15k
      });

      const alerts = await checkAlerts();

      const largeReimbursementAlert = alerts.find(a => a.type === 'LARGE_REIMBURSEMENT');
      expect(largeReimbursementAlert).toBeDefined();
      expect(largeReimbursementAlert?.severity).toBe('warning');
      expect(largeReimbursementAlert?.message).toContain('15,000');
    });

    it('generates REIMBURSEMENT_SPIKE alert when day-over-day increase exceeds threshold', async () => {
      // Mock today's reimbursements
      mockPrisma.reimbursement.aggregate
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('5000') } }) // today
        .mockResolvedValueOnce({ _sum: { amount: new Decimal('2000') } }); // yesterday

      const alerts = await checkAlerts();

      const spikeAlert = alerts.find(a => a.type === 'REIMBURSEMENT_SPIKE');
      expect(spikeAlert).toBeDefined();
      expect(spikeAlert?.severity).toBe('info');
      expect(spikeAlert?.metadata?.spikeRatio).toBeCloseTo(2.5);
    });

    it('generates SYNC_FAILURE alert when positions not updated recently', async () => {
      mockPrisma.position.findFirst.mockResolvedValue(null);
      mockPrisma.position.count.mockResolvedValue(10); // We have positions but none updated

      const alerts = await checkAlerts();

      const syncAlert = alerts.find(a => a.type === 'SYNC_FAILURE');
      expect(syncAlert).toBeDefined();
      expect(syncAlert?.severity).toBe('critical');
    });

    it('generates REIMBURSEMENT_FAILURE alert when recent reimbursements failed', async () => {
      mockPrisma.reimbursement.count.mockResolvedValue(3);

      const alerts = await checkAlerts();

      const failureAlert = alerts.find(a => a.type === 'REIMBURSEMENT_FAILURE');
      expect(failureAlert).toBeDefined();
      expect(failureAlert?.severity).toBe('critical');
      expect(failureAlert?.message).toContain('3 reimbursement');
    });
  });

  describe('getStoredAlerts', () => {
    const mockAlerts = [
      createMockAlert({ type: 'HIGH_APR', severity: 'critical' }),
      createMockAlert({ type: 'ELEVATED_APR', severity: 'warning' }),
      createMockAlert({ type: 'LARGE_REIMBURSEMENT', severity: 'info' }),
    ];

    beforeEach(() => {
      mockPrisma.alert.findMany.mockResolvedValue(mockAlerts);
    });

    it('returns all alerts by default', async () => {
      const alerts = await getStoredAlerts();

      expect(alerts).toHaveLength(3);
      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 0,
        })
      );
    });

    it('filters by severity', async () => {
      await getStoredAlerts({ severity: 'critical' });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            severity: 'critical',
          }),
        })
      );
    });

    it('filters by acknowledged status', async () => {
      await getStoredAlerts({ acknowledged: false });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            acknowledged: false,
          }),
        })
      );
    });

    it('filters by resolved status', async () => {
      await getStoredAlerts({ resolved: false });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            resolvedAt: null,
          }),
        })
      );
    });

    it('supports pagination with limit and offset', async () => {
      await getStoredAlerts({ limit: 10, offset: 20 });

      expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        })
      );
    });
  });

  describe('acknowledgeAlert', () => {
    it('acknowledges a single alert', async () => {
      const mockAlert = createMockAlert();
      mockPrisma.alert.update.mockResolvedValue({
        ...mockAlert,
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedBy: 'user-1',
      });

      const result = await acknowledgeAlert('alert-1', 'user-1');

      expect(result).toBeDefined();
      expect(result?.acknowledged).toBe(true);
      expect(mockPrisma.alert.update).toHaveBeenCalledWith({
        where: { id: 'alert-1' },
        data: expect.objectContaining({
          acknowledged: true,
          acknowledgedBy: 'user-1',
        }),
      });
    });

    it('returns null when alert not found', async () => {
      mockPrisma.alert.update.mockRejectedValue(new Error('Not found'));

      const result = await acknowledgeAlert('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('acknowledgeAlerts', () => {
    it('acknowledges multiple alerts', async () => {
      mockPrisma.alert.updateMany.mockResolvedValue({ count: 3 });

      const count = await acknowledgeAlerts(['alert-1', 'alert-2', 'alert-3'], 'user-1');

      expect(count).toBe(3);
      expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['alert-1', 'alert-2', 'alert-3'] } },
        data: expect.objectContaining({
          acknowledged: true,
          acknowledgedBy: 'user-1',
        }),
      });
    });
  });

  describe('getAlertCounts', () => {
    it('returns counts by severity', async () => {
      mockPrisma.alert.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(3)  // critical
        .mockResolvedValueOnce(4)  // warning
        .mockResolvedValueOnce(3)  // info
        .mockResolvedValueOnce(5); // unacknowledged

      const counts = await getAlertCounts();

      expect(counts).toEqual({
        total: 10,
        critical: 3,
        warning: 4,
        info: 3,
        unacknowledged: 5,
      });
    });
  });

  describe('getAlertStats', () => {
    it('returns daily statistics for the specified period', async () => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      mockPrisma.alert.findMany.mockResolvedValue([
        { createdAt: today, severity: 'critical' },
        { createdAt: today, severity: 'warning' },
        { createdAt: yesterday, severity: 'critical' },
      ]);

      const stats = await getAlertStats(7);

      expect(stats).toBeInstanceOf(Array);
      expect(stats.length).toBe(8); // 7 days + today

      // Each stat should have date and severity counts
      stats.forEach(stat => {
        expect(stat).toHaveProperty('date');
        expect(stat).toHaveProperty('critical');
        expect(stat).toHaveProperty('warning');
        expect(stat).toHaveProperty('info');
      });
    });
  });
});
