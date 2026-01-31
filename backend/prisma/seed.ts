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

// Token prices for USD calculations
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

function randomAddress(): string {
    const chars = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
        addr += chars[Math.floor(Math.random() * chars.length)];
    }
    return addr;
}

function randomTxHash(): string {
    return '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function main() {
    console.log('🧹 Clearing existing data...');
    await prisma.alert.deleteMany();
    await prisma.reimbursement.deleteMany();
    await prisma.interestAccrual.deleteMany();
    await prisma.dailySnapshot.deleteMany();
    await prisma.position.deleteMany();
    await prisma.borrower.deleteMany();
    await prisma.market.deleteMany();

    console.log('🌱 Seeding demo data...');

    // 1. Create Markets
    const markets = [
        {
            marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
            name: 'wstETH/WETH',
            collateralAsset: 'wstETH',
            loanAsset: 'WETH',
            vaultAddress: '0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF',
            lltv: new Decimal('0.915'),
            aprCap: new Decimal('0.08'), // 8%
        },
        {
            marketId: '0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b',
            name: 'WBTC/USDC',
            collateralAsset: 'WBTC',
            loanAsset: 'USDC',
            vaultAddress: '0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC',
            lltv: new Decimal('0.86'),
            aprCap: new Decimal('0.10'), // 10%
        },
        {
            marketId: '0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550',
            name: 'WPOL/USDC',
            collateralAsset: 'WPOL',
            loanAsset: 'USDC',
            vaultAddress: '0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8',
            lltv: new Decimal('0.77'),
            aprCap: new Decimal('0.12'), // 12%
        },
    ];

    for (const m of markets) {
        await prisma.market.create({ data: m });
    }
    console.log('  ✓ Created 3 markets');

    const dbMarkets = await prisma.market.findMany();

    // 2. Create Borrowers - mix of under and above cap
    const borrowerConfigs = [
        // Above cap borrowers (will need reimbursements)
        { address: '0x742d35cc6634c0532925a3b844bc9e7595f8feb1', aboveCap: true, size: 'large' },
        { address: '0x8ba1f109551bd432803012645ac136c6e7dd2a3b', aboveCap: true, size: 'large' },
        { address: '0xdf3e18d64bc6a983f673ab319ccae4f1a57c7097', aboveCap: true, size: 'medium' },
        { address: '0xcd3b766ccdd6ae721141f452c550ca635964ce71', aboveCap: true, size: 'medium' },
        { address: '0x2546bcd3c84621e976d8185a91a922ae77ecec30', aboveCap: true, size: 'small' },
        { address: '0x1234567890abcdef1234567890abcdef12345678', aboveCap: true, size: 'small' },
        { address: '0xabcdef1234567890abcdef1234567890abcdef12', aboveCap: true, size: 'medium' },
        // Under cap borrowers (compliant)
        { address: '0x9876543210fedcba9876543210fedcba98765432', aboveCap: false, size: 'large' },
        { address: '0xfedcba0987654321fedcba0987654321fedcba09', aboveCap: false, size: 'large' },
        { address: '0x1111222233334444555566667777888899990000', aboveCap: false, size: 'medium' },
        { address: '0xaaaabbbbccccddddeeeeffffgggg111122223333', aboveCap: false, size: 'medium' },
        { address: '0x5555666677778888999900001111222233334444', aboveCap: false, size: 'small' },
    ];

    // Add more random borrowers
    for (let i = 0; i < 35; i++) {
        borrowerConfigs.push({
            address: randomAddress(),
            aboveCap: Math.random() > 0.6, // 40% above cap
            size: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)] as 'small' | 'medium' | 'large',
        });
    }

    const sizeMultipliers = { small: 1, medium: 5, large: 20 };
    let positionCount = 0;
    let reimbursementCount = 0;

    for (const config of borrowerConfigs) {
        const borrower = await prisma.borrower.create({
            data: { address: config.address.toLowerCase() },
        });

        // Each borrower has 1-3 positions
        const numPositions = 1 + Math.floor(Math.random() * 3);
        const shuffledMarkets = [...dbMarkets].sort(() => Math.random() - 0.5).slice(0, numPositions);

        for (const market of shuffledMarkets) {
            const baseAmount = sizeMultipliers[config.size] * (0.8 + Math.random() * 0.4);
            const price = TOKEN_PRICES[market.loanAsset] || 1;

            // Principal in USD terms: small=$1k-5k, medium=$5k-25k, large=$20k-100k
            const principalUsd = baseAmount * 1000;
            const principalTokens = principalUsd / price;

            const position = await prisma.position.create({
                data: {
                    borrowerId: borrower.id,
                    marketId: market.id,
                    principal: toRawUnits(principalTokens, market.loanAsset),
                    collateral: toRawUnits(principalTokens * 1.4, market.collateralAsset),
                    isActive: true,
                    openedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000),
                },
            });
            positionCount++;

            const aprCap = parseFloat(market.aprCap.toString());

            // Create 14 days of interest accruals
            for (let d = 0; d < 14; d++) {
                const date = new Date();
                date.setDate(date.getDate() - d);
                date.setHours(0, 0, 0, 0);

                // APR: above cap gets 130-180% of cap, below cap gets 60-90% of cap
                const actualApr = config.aboveCap
                    ? aprCap * (1.3 + Math.random() * 0.5)
                    : aprCap * (0.6 + Math.random() * 0.3);

                const dailyInterest = principalTokens * (actualApr / 365);
                const cappedInterest = principalTokens * (aprCap / 365);
                const excessInterest = Math.max(0, dailyInterest - cappedInterest);

                await prisma.interestAccrual.create({
                    data: {
                        positionId: position.id,
                        date,
                        accruedAmt: toRawUnits(dailyInterest, market.loanAsset),
                        actualApr: new Decimal(actualApr),
                        cappedApr: market.aprCap,
                        excessAmt: toRawUnits(excessInterest, market.loanAsset),
                    },
                });
            }

            // Create reimbursements for above-cap positions
            if (config.aboveCap) {
                for (let d = 0; d <= 7; d++) {
                    const reimbDate = new Date();
                    reimbDate.setDate(reimbDate.getDate() - d);
                    reimbDate.setHours(0, 0, 0, 0);

                    // Reimbursement = excess interest in USD terms
                    const excessApr = aprCap * (0.3 + Math.random() * 0.5); // 30-80% excess
                    const dailyExcess = principalUsd * (excessApr / 365);

                    if (dailyExcess > 0.01) {
                        await prisma.reimbursement.create({
                            data: {
                                positionId: position.id,
                                date: reimbDate,
                                amount: toRawUnits(dailyExcess / price, market.loanAsset),
                                status: 'processed',
                                txHash: randomTxHash(),
                            },
                        });
                        reimbursementCount++;
                    }
                }
            }
        }
    }

    const totalBorrowers = borrowerConfigs.length;
    const aboveCapCount = borrowerConfigs.filter(b => b.aboveCap).length;
    console.log(`  ✓ Created ${totalBorrowers} borrowers (${aboveCapCount} above cap)`);
    console.log(`  ✓ Created ${positionCount} positions`);
    console.log(`  ✓ Created ${reimbursementCount} reimbursements`);

    // 3. Create Daily Snapshots for charts
    console.log('  Creating daily snapshots...');
    for (const market of dbMarkets) {
        for (let d = 0; d < 14; d++) {
            const date = new Date();
            date.setDate(date.getDate() - d);
            date.setHours(0, 0, 0, 0);

            const marketPositions = await prisma.position.count({ where: { marketId: market.id } });
            const variance = 0.85 + Math.random() * 0.3;

            await prisma.dailySnapshot.create({
                data: {
                    marketId: market.id,
                    date,
                    totalBorrowed: toRawUnits(500000 * variance, market.loanAsset),
                    avgApr: new Decimal(parseFloat(market.aprCap.toString()) * (0.9 + Math.random() * 0.4)),
                    borrowerCount: Math.floor(marketPositions * variance),
                    aboveCapCount: Math.floor(marketPositions * variance * 0.4),
                },
            });
        }
    }

    // 4. Create Active Alerts (visible in dashboard)
    console.log('  Creating alerts...');
    const now = new Date();

    await prisma.alert.createMany({
        data: [
            {
                type: 'HIGH_APR',
                severity: 'critical',
                message: 'wstETH/WETH market APR at 14.8% (185% of 8% cap)',
                marketId: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
                marketName: 'wstETH/WETH',
                acknowledged: false,
                metadata: { currentApr: 1480, capApr: 800, ratio: 1.85 },
                createdAt: new Date(now.getTime() - 15 * 60 * 1000), // 15 min ago
            },
            {
                type: 'ELEVATED_APR',
                severity: 'warning',
                message: 'WBTC/USDC market APR at 16% (160% of 10% cap)',
                marketId: '0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b',
                marketName: 'WBTC/USDC',
                acknowledged: false,
                metadata: { currentApr: 1600, capApr: 1000, ratio: 1.6 },
                createdAt: new Date(now.getTime() - 45 * 60 * 1000), // 45 min ago
            },
            {
                type: 'LARGE_REIMBURSEMENT',
                severity: 'warning',
                message: 'Daily reimbursement total: $8,234',
                acknowledged: false,
                metadata: { amount: 8234 },
                createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
            },
            {
                type: 'REIMBURSEMENT_SPIKE',
                severity: 'info',
                message: 'Reimbursements up 42% vs yesterday',
                acknowledged: true,
                acknowledgedBy: 'system',
                acknowledgedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
                metadata: { spikePercent: 42 },
                createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
            },
        ],
    });

    console.log('  ✓ Created 4 alerts (2 critical/warning unacknowledged)');
    console.log('');
    console.log('✅ Demo seeding complete!');
    console.log('');
    console.log('📊 Dashboard should now show:');
    console.log(`   - ${totalBorrowers} total borrowers`);
    console.log(`   - ${totalBorrowers - aboveCapCount} under APR cap`);
    console.log(`   - ${aboveCapCount} above APR cap (need reimbursement)`);
    console.log('   - Daily reimbursements chart with 7 days of data');
    console.log('   - Active alerts in the alerts panel');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
