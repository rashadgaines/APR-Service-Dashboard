import { Decimal } from 'decimal.js';
import {
  calculateDailyInterest,
  calculateExcessInterest,
  calculateWeightedApr,
  bpsToDecimal,
  annualRateToBps,
} from '../../src/services/interest/calculator';

describe('Interest Calculator', () => {
  describe('calculateDailyInterest', () => {
    it('calculates daily interest correctly for 10% APR', () => {
      // 1000 USDC at 10% APR should yield ~0.274 USDC/day
      const principal = new Decimal('1000');
      const aprBps = 1000; // 10% in basis points
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      // Expected: 1000 * (0.10 / 365) = 0.273972602739726
      expect(dailyInterest.toFixed(6)).toBe('0.273973');
    });

    it('calculates daily interest for 8% APR cap', () => {
      const principal = new Decimal('1200000'); // $1.2M
      const aprBps = 800; // 8%
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      // Expected: 1200000 * (0.08 / 365) = ~263.01
      expect(dailyInterest.toFixed(2)).toBe('263.01');
    });

    it('returns zero for zero principal', () => {
      const principal = new Decimal('0');
      const aprBps = 1000;
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      expect(dailyInterest.toString()).toBe('0');
    });

    it('returns zero for zero APR', () => {
      const principal = new Decimal('1000');
      const aprBps = 0;
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      expect(dailyInterest.toString()).toBe('0');
    });
  });

  describe('calculateExcessInterest', () => {
    it('returns zero when APR is under cap', () => {
      const principal = new Decimal('1000');
      const actualApr = 800; // 8%
      const capApr = 1000; // 10%
      const excess = calculateExcessInterest(principal, actualApr, capApr);

      expect(excess.toString()).toBe('0');
    });

    it('calculates excess when APR is above cap', () => {
      const principal = new Decimal('1000');
      const actualApr = 1500; // 15%
      const capApr = 1000; // 10%
      const excess = calculateExcessInterest(principal, actualApr, capApr);

      // Excess = (15% - 10%) * 1000 / 365 = 0.137
      expect(excess.toFixed(3)).toBe('0.137');
    });

    it('calculates excess for large principal', () => {
      const principal = new Decimal('1200000'); // $1.2M
      const actualApr = 1820; // 18.2%
      const capApr = 1000; // 10%
      const excess = calculateExcessInterest(principal, actualApr, capApr);

      // Excess = (18.2% - 10%) * 1200000 / 365 = 8.2% * 1200000 / 365 = ~269.59
      expect(excess.toFixed(2)).toBe('269.59');
    });

    it('returns zero for equal APRs', () => {
      const principal = new Decimal('1000');
      const apr = 1000;
      const excess = calculateExcessInterest(principal, apr, apr);

      expect(excess.toString()).toBe('0');
    });
  });

  describe('calculateWeightedApr', () => {
    it('calculates weighted average correctly', () => {
      const positions = [
        { principal: new Decimal('1000'), aprBps: 800 },  // 8%
        { principal: new Decimal('2000'), aprBps: 1200 }, // 12%
      ];

      const weightedApr = calculateWeightedApr(positions);

      // Expected: (1000*800 + 2000*1200) / (1000+2000) = 3200000/3000 = 1066.67 (10.67%)
      expect(Math.round(weightedApr)).toBe(1067);
    });

    it('returns zero for empty positions', () => {
      const weightedApr = calculateWeightedApr([]);
      expect(weightedApr).toBe(0);
    });

    it('handles single position', () => {
      const positions = [{ principal: new Decimal('5000'), aprBps: 1500 }];
      const weightedApr = calculateWeightedApr(positions);
      expect(weightedApr).toBe(1500);
    });
  });

  describe('bpsToDecimal', () => {
    it('converts basis points to decimal correctly', () => {
      expect(bpsToDecimal(100).toString()).toBe('0.01'); // 1%
      expect(bpsToDecimal(800).toString()).toBe('0.08'); // 8%
      expect(bpsToDecimal(1200).toString()).toBe('0.12'); // 12%
    });

    it('handles zero', () => {
      expect(bpsToDecimal(0).toString()).toBe('0');
    });
  });

  describe('annualRateToBps', () => {
    it('converts annual rate to basis points', () => {
      expect(annualRateToBps(0.08)).toBe(800); // 8%
      expect(annualRateToBps(0.10)).toBe(1000); // 10%
      expect(annualRateToBps(0.182)).toBe(1820); // 18.2%
    });

    it('rounds correctly', () => {
      expect(annualRateToBps(0.0834)).toBe(834); // Should round to 834
    });
  });

  describe('edge cases', () => {
    it('handles very small decimals', () => {
      const principal = new Decimal('0.000001');
      const aprBps = 1; // 0.01%
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      expect(dailyInterest.isPositive()).toBe(true);
      // Very small numbers may use scientific notation
      expect(dailyInterest.toNumber()).toBeLessThan(1e-10);
    });

    it('handles very large numbers', () => {
      const principal = new Decimal('1000000000'); // 1B
      const aprBps = 1000; // 10%
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      // 1B * 10% / 365 = 273,972.60
      expect(dailyInterest.toFixed(2)).toBe('273972.60');
    });

    it('maintains precision with many decimal places', () => {
      const principal = new Decimal('1234.567890123456789');
      const aprBps = 876; // 8.76%
      const dailyInterest = calculateDailyInterest(principal, aprBps);

      // Should maintain precision
      expect(dailyInterest.toString().length).toBeGreaterThan(10);
    });
  });
});