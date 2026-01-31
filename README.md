# Gondor APR Service

Backend service + monitoring dashboard for enforcing APR caps on Morpho lending pools (Polygon).

## What It Does

Morpho uses floating interest rates, but borrowers prefer predictable APRs. This service:
- **Tracks positions** from Morpho markets via on-chain queries (viem)
- **Computes daily reimbursements** for interest above the APR cap
- **Executes reimbursements** via ERC20 transfers on Polygon
- **Stores history** in PostgreSQL (positions, interest accruals, reimbursements)
- **Monitors** with a real-time dashboard showing borrowers, reimbursements, and alerts

## Quick Start

```bash
# 1. Start PostgreSQL
docker run --name gondor-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=gondor -p 5432:5432 -d postgres:15

# 2. Setup backend
cd backend
cp .env.example .env  # Configure DATABASE_URL, POLYGON_RPC_URL, PRIVATE_KEY
npm install
npx prisma migrate dev
npx prisma db seed    # Load demo data
npm run dev           # Runs on :3003

# 3. Setup frontend (new terminal)
cd frontend
npm install
npm run dev           # Runs on :3000
```

Open http://localhost:3000

## Configured Markets

| Market | APR Cap | Vault |
|--------|---------|-------|
| wstETH/WETH (91.5% LLTV) | 8% | `0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF` |
| WBTC/USDC (86% LLTV) | 10% | `0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC` |
| WPOL/USDC (77% LLTV) | 12% | `0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8` |

## Tech Stack

- **Backend**: Node.js, TypeScript, Express, Prisma, viem
- **Frontend**: Next.js 14, React, TailwindCSS, Recharts
- **Database**: PostgreSQL
- **Blockchain**: Polygon via viem

## Project Structure

```
backend/
├── src/
│   ├── services/
│   │   ├── interest/      # Daily interest & excess calculation
│   │   ├── reimbursement/ # Batch processing & on-chain execution
│   │   ├── morpho/        # On-chain queries via viem
│   │   ├── sync/          # Position sync from Morpho
│   │   └── alerts/        # APR violation detection
│   └── api/routes/        # REST endpoints
├── prisma/                # DB schema & migrations
└── tests/                 # Unit & integration tests

frontend/
├── src/app/              # Dashboard pages
└── src/components/       # Charts, cards, alerts UI
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | System health (DB, RPC, wallet) |
| `GET /api/metrics/overview` | TVL, borrowers under/above cap, reimbursements |
| `GET /api/metrics/daily` | Daily reimbursement chart data |
| `GET /api/metrics/markets` | Per-market breakdown |
| `GET /api/alerts` | Active alerts (APR > 2x cap, large reimbursements) |
| `GET /api/reimbursements` | Reimbursement history |
| `POST /api/jobs/position-sync/run` | Trigger position sync |
| `POST /api/jobs/daily-reimbursement/run` | Trigger reimbursement processing |

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Position Sync | Every 15 min | Fetch positions from Morpho |
| Daily Accrual | 00:00 UTC | Calculate interest for all positions |
| Reimbursement | 01:00 UTC | Process pending reimbursements |

## Tests

```bash
cd backend && npm test
```

Covers: interest calculations, excess computation, reimbursement processing, alert detection.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `POLYGON_RPC_URL` | Yes | Polygon RPC endpoint |
| `PRIVATE_KEY` | Yes | Wallet key for reimbursements (hex) |

## Dashboard Features

- **Overview**: TVL, active borrowers, under/above APR cap counts
- **Charts**: Daily reimbursement amounts (30 days)
- **Markets**: Breakdown by market with borrower counts
- **Alerts**: APR violations (>1.5x cap warning, >2x cap critical), reimbursement spikes
