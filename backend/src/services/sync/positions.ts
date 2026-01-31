import { prisma } from '@/config/database';
import { getAllActivePositions, getMarketAPR } from '@/services/morpho/queries';
import { MARKETS, getMarketById } from '@/config/constants';
import { logger } from '@/utils/logger';

export interface SyncResult {
  marketsProcessed: number;
  positionsCreated: number;
  positionsUpdated: number;
  errors: string[];
}

/**
 * Sync positions from Morpho to database
 * This job runs every 15 minutes to keep positions up to date
 */
export async function syncPositions(): Promise<SyncResult> {
  const result: SyncResult = {
    marketsProcessed: 0,
    positionsCreated: 0,
    positionsUpdated: 0,
    errors: [],
  };

  try {
    logger.info('Starting position sync');

    // Get all market positions from Morpho
    const marketPositions = await getAllActivePositions();

    for (const { marketId, positions } of marketPositions) {
      try {
        result.marketsProcessed++;

        // Get market configuration
        const marketConfig = Object.values(MARKETS).find(m => m.id === marketId);
        if (!marketConfig) {
          logger.warn(`Unknown market ID: ${marketId}`);
          continue;
        }

        // Get vault address from market config
        const vaultAddress = marketConfig.vault;

        // Ensure market exists in database
        await prisma.market.upsert({
          where: { marketId },
          update: {
            vaultAddress, // Update vault address if changed
          },
          create: {
            marketId,
            vaultAddress,
            name: marketConfig.name,
            collateralAsset: marketConfig.collateralAsset,
            loanAsset: marketConfig.loanAsset,
            lltv: marketConfig.lltv,
            aprCap: marketConfig.aprCapBps / 100, // Convert bps to decimal
          },
        });

        // Get market record ID
        const marketRecord = await prisma.market.findUnique({
          where: { marketId },
        });
        if (!marketRecord) {
          logger.warn(`Market record not found for ${marketId}`);
          continue;
        }

        // Process each position with transaction for data integrity
        for (const position of positions) {
          try {
            // Use transaction to ensure borrower + position are created/updated atomically
            const syncResult = await prisma.$transaction(async (tx) => {
              // Ensure borrower exists and get ID
              const borrowerRecord = await tx.borrower.upsert({
                where: { address: position.borrower },
                update: {},
                create: { address: position.borrower },
              });

              // Find existing position using the Prisma record IDs
              const existingPosition = await tx.position.findFirst({
                where: {
                  borrowerId: borrowerRecord.id,
                  marketId: marketRecord.id,
                  isActive: true,
                },
              });

              if (existingPosition) {
                // Update existing position
                await tx.position.update({
                  where: { id: existingPosition.id },
                  data: {
                    principal: position.borrowed,
                    collateral: position.collateral,
                    isActive: position.isActive,
                  },
                });
                return 'updated';
              } else {
                // Create new position using relation IDs
                await tx.position.create({
                  data: {
                    borrowerId: borrowerRecord.id,
                    marketId: marketRecord.id,
                    principal: position.borrowed,
                    collateral: position.collateral,
                    isActive: position.isActive,
                    openedAt: new Date(),
                  },
                });
                return 'created';
              }
            });

            if (syncResult === 'created') {
              result.positionsCreated++;
            } else {
              result.positionsUpdated++;
            }
          } catch (error) {
            const errorMsg = `Failed to sync position for borrower ${position.borrower}: ${error}`;
            logger.error(errorMsg);
            result.errors.push(errorMsg);
          }
        }

        logger.info(`Processed ${positions.length} positions for market ${marketConfig.name}`);

      } catch (error) {
        const errorMsg = `Failed to sync market ${marketId}: ${error}`;
        logger.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }

    logger.info(`Position sync completed: ${result.marketsProcessed} markets, ${result.positionsCreated} created, ${result.positionsUpdated} updated`);

  } catch (error) {
    const errorMsg = `Position sync failed: ${error}`;
    logger.error(errorMsg);
    result.errors.push(errorMsg);
  }

  return result;
}

/**
 * Mark positions as inactive if they're no longer active on-chain
 */
export async function deactivateClosedPositions(): Promise<number> {
  let deactivatedCount = 0;

  try {
    // Get all active positions from Morpho
    const activePositions = await getAllActivePositions();
    const activePositionKeys = new Set<string>();

    // Build set of active position keys (borrower + market)
    for (const { marketId, positions } of activePositions) {
      for (const position of positions) {
        if (position.isActive) {
          activePositionKeys.add(`${position.borrower}:${marketId}`);
        }
      }
    }

    // Find positions in DB that are marked active but not in active set
    const dbPositions = await prisma.position.findMany({
      where: { isActive: true },
      select: { id: true, borrowerId: true, marketId: true },
    });

    // Collect IDs to deactivate
    const positionsToDeactivate: string[] = [];
    for (const dbPos of dbPositions) {
      const key = `${dbPos.borrowerId}:${dbPos.marketId}`;
      if (!activePositionKeys.has(key)) {
        positionsToDeactivate.push(dbPos.id);
      }
    }

    // Batch update in a single transaction for better performance and atomicity
    if (positionsToDeactivate.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.position.updateMany({
          where: { id: { in: positionsToDeactivate } },
          data: {
            isActive: false,
            closedAt: new Date(),
          },
        });
      });
      deactivatedCount = positionsToDeactivate.length;
    }

    if (deactivatedCount > 0) {
      logger.info(`Deactivated ${deactivatedCount} closed positions`);
    }

  } catch (error) {
    logger.error(`Failed to deactivate closed positions: ${error}`);
  }

  return deactivatedCount;
}