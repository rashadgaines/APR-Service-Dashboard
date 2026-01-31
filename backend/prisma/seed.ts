import { PrismaClient } from '@prisma/client';
import { Decimal } from 'decimal.js';

const prisma = new PrismaClient();

const TOKEN_DECIMALS: Record<string, number> = {
    WETH: 18,
    wstETH: 18,
    WBTC: 8,
    USDC: 6,
    USDT: 6,
    WPOL: 18,
    POL: 18,
};

// Realistic token prices for USD calculations
const TOKEN_PRICES: Record<string, number> = {
    WETH: 3200,
    wstETH: 3600,
    WBTC: 95000,
    USDC: 1,
    USDT: 1,
    WPOL: 0.45,
};

function toRawUnits(amount: number, asset: string): Decimal {
    const decimals = TOKEN_DECIMALS[asset] || 18;
    return new Decimal(amount).mul(new Decimal(10).pow(decimals));
}

// Generate realistic random address
function randomAddress(): string {
    const chars = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
        addr += chars[Math.floor(Math.random() * chars.length)];
    }
    return addr;
}

// Generate random APR between min and max (in decimal form)
function randomApr(min: number, max: number): Decimal {
    return new Decimal(min + Math.random() * (max - min));
}

async function main() {
    console.log('🌱 Seeding database with scaled units...');

    // 1. Create Markets
    const markets = [
        {
            marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
            name: 'wstETH/WETH',
            collateralAsset: 'wstETH',
            loanAsset: 'WETH',
            vaultAddress: '0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF',
            lltv: new Decimal('0.915'),
            aprCap: new Decimal('0.08'),
        },
        {
            marketId: '0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b',
            name: 'WBTC/USDC',
            collateralAsset: 'WBTC',
            loanAsset: 'USDC',
            vaultAddress: '0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC',
            lltv: new Decimal('0.86'),
            aprCap: new Decimal('0.10'),
        },
        {
            marketId: '0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550',
            name: 'WPOL/USDC',
            collateralAsset: 'WPOL',
            loanAsset: 'USDC',
            vaultAddress: '0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8',
            lltv: new Decimal('0.77'),
            aprCap: new Decimal('0.12'),
        },
    ];

    for (const m of markets) {
        await prisma.market.upsert({
            where: { marketId: m.marketId },
            update: m,
            create: m,
        });
    }

    // 2. Create sample Borrowers (more realistic count for demo)
    const borrowerCount = 12; // Enough to show variety
    const borrowers = [];

    // Some known addresses for demo
    const knownAddresses = [
        '0x742d35Cc6634C0532925a3b844Bc9e7595f8fEb1',
        '0x8ba1f109551bD432803012645Hac136c6e7dD2A',
        '0xdF3e18d64BC6A983f673Ab319CCaE4f1a57C7097',
        '0xcd3B766CCdD6AE721141F452C550Ca635964ce71',
        '0x2546BcD3c84621e976D8185a91A922aE77ECEc30',
    ];

    for (let i = 0; i < borrowerCount; i++) {
        const addr = i < knownAddresses.length ? knownAddresses[i] : randomAddress();
        borrowers.push({ address: addr.toLowerCase() });
    }

    const createdBorrowers = [];
    for (const b of borrowers) {
        const created = await prisma.borrower.upsert({
            where: { address: b.address },
            update: {},
            create: b,
        });
        createdBorrowers.push(created);
    }
    console.log(`  Created ${createdBorrowers.length} borrowers`);

    // 3. Create sample Positions with variety
    const dbMarkets = await prisma.market.findMany();
    let positionCount = 0;
    let accrualCount = 0;
    let reimbursementCount = 0;

    for (let i = 0; i < createdBorrowers.length; i++) {
        const borrower = createdBorrowers[i];

        // Each borrower has positions in 1-3 markets randomly
        const marketCount = 1 + Math.floor(Math.random() * dbMarkets.length);
        const shuffledMarkets = [...dbMarkets].sort(() => Math.random() - 0.5).slice(0, marketCount);

        for (const market of shuffledMarkets) {
            // Vary position sizes realistically
            const principalMultiplier = 0.5 + Math.random() * 10; // 0.5x to 10.5x base
            const collateralMultiplier = principalMultiplier * (1.2 + Math.random() * 0.3); // 120-150% collateral ratio

            const position = await prisma.position.create({
                data: {
                    borrowerId: borrower.id,
                    marketId: market.id,
                    principal: toRawUnits(principalMultiplier, market.loanAsset),
                    collateral: toRawUnits(collateralMultiplier, market.collateralAsset),
                    isActive: Math.random() > 0.1, // 90% active
                    openedAt: new Date(Date.now() - Math.floor(Math.random() * 60) * 24 * 60 * 60 * 1000), // 0-60 days ago
                },
            });
            positionCount++;

            // 4. Create Interest Accruals for last 30 days
            // Some borrowers above cap, some below, some mixed
            const isAboveCap = Math.random() > 0.6; // 40% above cap
            const aprCapDecimal = parseFloat(market.aprCap.toString());

            for (let d = 0; d < 30; d++) {
                const date = new Date();
                date.setDate(date.getDate() - d);
                date.setHours(0, 0, 0, 0);

                // Vary APR - sometimes above cap, sometimes below
                const dayVariance = Math.random() > 0.7; // 30% chance of different behavior
                const actualAprValue = isAboveCap !== dayVariance
                    ? aprCapDecimal * (1.1 + Math.random() * 0.9) // 110% to 200% of cap
                    : aprCapDecimal * (0.5 + Math.random() * 0.4); // 50% to 90% of cap

                const dailyInterest = principalMultiplier * (actualAprValue / 365);
                const cappedInterest = principalMultiplier * (aprCapDecimal / 365);
                const excessInterest = Math.max(0, dailyInterest - cappedInterest);

                await prisma.interestAccrual.create({
                    data: {
                        positionId: position.id,
                        date: date,
                        accruedAmt: toRawUnits(dailyInterest, market.loanAsset),
                        actualApr: new Decimal(actualAprValue),
                        cappedApr: market.aprCap,
                        excessAmt: toRawUnits(excessInterest, market.loanAsset),
                    },
                });
                accrualCount++;
            }

            // 5. Create Reimbursements for positions above cap (past week)
            if (isAboveCap) {
                for (let d = 1; d <= 7; d++) {
                    if (Math.random() > 0.3) { // 70% chance of reimbursement
                        const reimbDate = new Date();
                        reimbDate.setDate(reimbDate.getDate() - d);

                        const reimbAmount = principalMultiplier * 0.0002 * (0.5 + Math.random()); // Vary amounts

                        await prisma.reimbursement.create({
                            data: {
                                positionId: position.id,
                                date: reimbDate,
                                amount: toRawUnits(reimbAmount, market.loanAsset),
                                status: Math.random() > 0.05 ? 'processed' : 'failed', // 5% failed
                                txHash: '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
                            },
                        });
                        reimbursementCount++;
                    }
                }
            }
        }
    }
    console.log(`  Created ${positionCount} positions, ${accrualCount} accruals, ${reimbursementCount} reimbursements`);

    // 6. Create Daily Snapshots (30 days of history)
    console.log('  Creating daily snapshots...');
    for (const market of dbMarkets) {
        // Calculate actual position counts for this market
        const marketPositions = await prisma.position.findMany({
            where: { marketId: market.id },
            select: { principal: true, borrowerId: true },
        });

        const uniqueBorrowers = new Set(marketPositions.map(p => p.borrowerId)).size;
        const totalPrincipal = marketPositions.reduce((sum, p) => sum.add(new Decimal(p.principal.toString())), new Decimal(0));

        for (let i = 0; i < 30; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);

            // Add some variance to historical data
            const variance = 0.9 + Math.random() * 0.2;
            const aprCapValue = parseFloat(market.aprCap.toString());
            const avgAprValue = aprCapValue * (0.8 + Math.random() * 0.6); // 80% to 140% of cap

            await prisma.dailySnapshot.upsert({
                where: {
                    marketId_date: { marketId: market.id, date },
                },
                update: {},
                create: {
                    marketId: market.id,
                    date: date,
                    totalBorrowed: totalPrincipal.mul(variance),
                    avgApr: new Decimal(avgAprValue),
                    borrowerCount: Math.max(1, Math.floor(uniqueBorrowers * variance)),
                    aboveCapCount: Math.floor(uniqueBorrowers * variance * 0.4), // ~40% above cap
                },
            });
        }
    }

    // 7. Create sample Alerts with variety
    console.log('  Creating alerts...');
    const alertConfigs = [
        {
            type: 'HIGH_APR',
            severity: 'critical',
            message: 'wstETH/WETH market APR is 185% above cap (14.8% vs 8%)',
            marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
            marketName: 'wstETH/WETH',
            acknowledged: false,
            metadata: { currentApr: 1480, capApr: 800, ratio: 1.85 },
        },
        {
            type: 'ELEVATED_APR',
            severity: 'warning',
            message: 'WBTC/USDC market APR is 160% above cap (16% vs 10%)',
            marketId: '0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b',
            marketName: 'WBTC/USDC',
            acknowledged: false,
            metadata: { currentApr: 1600, capApr: 1000, ratio: 1.6 },
        },
        {
            type: 'LARGE_REIMBURSEMENT',
            severity: 'warning',
            message: 'Large daily reimbursement: $12,450',
            acknowledged: true,
            acknowledgedBy: 'admin@gondor.fi',
            metadata: { amount: 12450 },
        },
        {
            type: 'REIMBURSEMENT_SPIKE',
            severity: 'info',
            message: 'Reimbursement spike: +65% ($8,200 vs $4,970 yesterday)',
            acknowledged: true,
            acknowledgedBy: 'system',
            metadata: { todayAmount: 8200, yesterdayAmount: 4970, spikeRatio: 1.65 },
        },
        {
            type: 'SYNC_FAILURE',
            severity: 'critical',
            message: 'Position sync may have failed - no recent updates',
            acknowledged: true,
            acknowledgedBy: 'ops@gondor.fi',
            resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Resolved 2 hours ago
        },
    ];

    for (const alert of alertConfigs) {
        const createdAt = new Date(Date.now() - Math.floor(Math.random() * 48) * 60 * 60 * 1000); // 0-48 hours ago

        await prisma.alert.create({
            data: {
                type: alert.type,
                severity: alert.severity,
                message: alert.message,
                marketId: alert.marketId || null,
                marketName: alert.marketName || null,
                metadata: alert.metadata || null,
                acknowledged: alert.acknowledged || false,
                acknowledgedBy: alert.acknowledgedBy || null,
                acknowledgedAt: alert.acknowledged ? new Date(createdAt.getTime() + 30 * 60 * 1000) : null,
                resolvedAt: alert.resolvedAt || null,
                createdAt,
            },
        });
    }

    console.log('✅ Seeding complete with correct scaling!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
