import { Router, Request, Response } from 'express';
import { prisma } from '@/config/database';
import { asyncHandler, AppError } from '@/api/middleware/error';
import { validate, borrowerParamsSchema, normalizeAddress } from '@/api/middleware/validation';
import { TOKEN_DECIMALS, TOKEN_PRICES } from '@/config/constants';
import { Decimal } from 'decimal.js';

const router = Router();

/**
 * GET /api/borrowers/:address
 * Returns detailed information for a specific borrower
 */
router.get(
  '/:address',
  validate(borrowerParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;

    // Normalize address to lowercase
    const normalizedAddress = normalizeAddress(address);

  const borrower = await prisma.borrower.findUnique({
    where: { address: normalizedAddress },
    include: {
      positions: {
        include: {
          market: true,
          interestAccruals: {
            orderBy: { date: 'desc' },
            take: 30, // Last 30 days
          },
          reimbursements: {
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  });

  if (!borrower) {
    throw new AppError('Borrower not found', 404);
  }

  // Calculate summary statistics
  const activePositions = borrower.positions.filter(p => p.isActive);
  const totalBorrowed = activePositions.reduce(
    (sum, pos) => sum.add(new Decimal(pos.principal.toString())),
    new Decimal(0)
  );

  const totalCollateral = activePositions.reduce(
    (sum, pos) => sum.add(new Decimal(pos.collateral.toString())),
    new Decimal(0)
  );

  const totalExcessInterest = borrower.positions.reduce((sum, pos) => {
    const positionExcess = pos.interestAccruals.reduce(
      (posSum, accrual) => posSum.add(new Decimal(accrual.excessAmt.toString())),
      new Decimal(0)
    );
    return sum.add(positionExcess);
  }, new Decimal(0));

  const totalReimbursed = borrower.positions.reduce((sum, pos) => {
    const positionReimbursed = pos.reimbursements.reduce(
      (posSum, reimbursement) => posSum.add(new Decimal(reimbursement.amount.toString())),
      new Decimal(0)
    );
    return sum.add(positionReimbursed);
  }, new Decimal(0));

  const positions = borrower.positions.map(pos => {
    // Get token decimals for proper conversion
    const decimals = TOKEN_DECIMALS[pos.market.loanAsset] || 18;
    const price = TOKEN_PRICES[pos.market.loanAsset] || 1;
    
    const principalHuman = new Decimal(pos.principal.toString()).div(new Decimal(10).pow(decimals));
    const collateralHuman = new Decimal(pos.collateral.toString()).div(new Decimal(10).pow(decimals));
    
    return {
      id: pos.id,
      marketId: pos.market.marketId,
      marketName: pos.market.name,
      principal: principalHuman.mul(price).toFixed(2),
      collateral: collateralHuman.mul(price).toFixed(2),
      isActive: pos.isActive,
      openedAt: pos.openedAt,
      closedAt: pos.closedAt,
      totalAccrued: pos.interestAccruals.reduce(
        (sum, accrual) => sum.add(new Decimal(accrual.accruedAmt.toString())),
        new Decimal(0)
      ).toString(),
      totalExcess: pos.interestAccruals.reduce(
        (sum, accrual) => sum.add(new Decimal(accrual.excessAmt.toString())),
        new Decimal(0)
      ).toString(),
      totalReimbursed: pos.reimbursements.reduce(
        (sum, reimbursement) => sum.add(new Decimal(reimbursement.amount.toString())),
        new Decimal(0)
      ).toString(),
      recentAccruals: pos.interestAccruals.slice(0, 10),
      recentReimbursements: pos.reimbursements.slice(0, 5),
    };
  });

  res.json({
    borrower: {
      address: borrower.address,
      createdAt: borrower.createdAt,
      totalBorrowed: totalBorrowed.toString(),
      totalCollateral: totalCollateral.toString(),
      totalExcessInterest: totalExcessInterest.toString(),
      totalReimbursed: totalReimbursed.toString(),
      pendingReimbursement: totalExcessInterest.sub(totalReimbursed).toString(),
      activePositions: activePositions.length,
      totalPositions: borrower.positions.length,
    },
    positions,
  });
  })
);

export default router;