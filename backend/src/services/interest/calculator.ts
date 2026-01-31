import { Decimal } from 'decimal.js';

/**
 * Calculate daily interest for a principal amount at a given APR
 * @param principal - The principal amount (in smallest unit, e.g. wei for ETH)
 * @param aprBps - Annual percentage rate in basis points (100 = 1%)
 * @returns Daily interest amount
 */
export function calculateDailyInterest(principal: Decimal, aprBps: number): Decimal {
  // APR in basis points to decimal (e.g., 800 = 8%)
  const aprDecimal = new Decimal(aprBps).div(10000);

  // Daily rate = annual rate / 365
  const dailyRate = aprDecimal.div(365);

  // Daily interest = principal * daily rate
  return principal.mul(dailyRate);
}

/**
 * Calculate the excess interest when actual APR exceeds the cap
 * @param principal - The principal amount
 * @param actualAprBps - Actual APR in basis points
 * @param capAprBps - Cap APR in basis points
 * @returns Excess interest amount (0 if under cap)
 */
export function calculateExcessInterest(
  principal: Decimal,
  actualAprBps: number,
  capAprBps: number
): Decimal {
  if (actualAprBps <= capAprBps) {
    return new Decimal(0);
  }

  const actualInterest = calculateDailyInterest(principal, actualAprBps);
  const cappedInterest = calculateDailyInterest(principal, capAprBps);

  return actualInterest.sub(cappedInterest);
}

/**
 * Calculate APR from annual percentage rate
 * @param annualRate - Annual rate as decimal (e.g., 0.08 for 8%)
 * @returns APR in basis points
 */
export function annualRateToBps(annualRate: number): number {
  return Math.round(annualRate * 10000);
}

/**
 * Convert basis points to decimal percentage
 * @param bps - Value in basis points
 * @returns Decimal percentage (e.g., 800 -> 0.08)
 */
export function bpsToDecimal(bps: number): Decimal {
  return new Decimal(bps).div(10000);
}

/**
 * Calculate compound interest over multiple days
 * @param principal - Initial principal
 * @param dailyRate - Daily interest rate as decimal
 * @param days - Number of days
 * @returns Final amount after compounding
 */
export function calculateCompoundInterest(
  principal: Decimal,
  dailyRate: Decimal,
  days: number
): Decimal {
  // Final amount = principal * (1 + dailyRate)^days
  const compoundFactor = new Decimal(1).add(dailyRate).pow(days);
  return principal.mul(compoundFactor);
}

/**
 * Validate APR values
 * @param aprBps - APR in basis points
 * @returns True if valid
 */
export function isValidApr(aprBps: number): boolean {
  return aprBps >= 0 && aprBps <= 100000; // Max 1000% APR
}

/**
 * Calculate the effective APR from multiple positions
 * @param positions - Array of {principal, aprBps} objects
 * @returns Weighted average APR in basis points
 */
export function calculateWeightedApr(
  positions: Array<{ principal: Decimal; aprBps: number }>
): number {
  if (positions.length === 0) return 0;

  let totalPrincipal = new Decimal(0);
  let weightedSum = new Decimal(0);

  for (const position of positions) {
    totalPrincipal = totalPrincipal.add(position.principal);
    weightedSum = weightedSum.add(position.principal.mul(position.aprBps));
  }

  if (totalPrincipal.isZero()) return 0;

  return weightedSum.div(totalPrincipal).toNumber();
}