# Gondor APR Service

A comprehensive APR cap enforcement system for Morpho lending pools on Polygon, featuring real-time monitoring, automated reimbursements, and a professional dark-themed dashboard.

## Overview

Gondor processes loans against Polymarket positions through permissionless Morpho lending pools. While Morpho's Interest Rate Model uses supply/demand-based fluctuating rates, borrowers prefer predictable APRs. This service:

1. **Enforces APR caps** per market
2. **Tracks excess interest** when rates exceed caps
3. **Processes reimbursements** to maintain predictable rates for borrowers
4. **Monitors system health** with real-time alerts

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js UI    │────▶│   Express API   │────▶│   PostgreSQL    │
│   (Port 3000)   │     │   (Port 3003)   │     │   Database      │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                │
                       ┌────────▼────────┐
                       │  Morpho GraphQL │
                       │  API (Polygon)  │
                       └─────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 18, TailwindCSS, Recharts |
| Backend | Express.js, TypeScript, Zod validation |
| Database | PostgreSQL 15, Prisma ORM |
| Blockchain | Viem, Morpho GraphQL API |
| Scheduling | node-cron |

## Quick Start (Docker)

The easiest way to run the project:

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 3. Run database migrations
cd backend && npx prisma migrate dev --name init

# 4. Start backend (Terminal 1)
cd backend && npm run dev

# 5. Start frontend (Terminal 2)
cd frontend && npm run dev

# 6. Sync initial data
curl -X POST http://localhost:3003/api/jobs/position-sync/run

# 7. Open dashboard
open http://localhost:3000
```

### Run Everything in Docker

```bash
# Build and run all services
docker compose --profile full up --build

# Or just the database
docker compose up -d postgres
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL) or PostgreSQL 15+ installed locally
- npm

### Manual Installation

1. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd gondor-take-home

   # Install all dependencies
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **Start PostgreSQL (Docker):**
   ```bash
   docker compose up -d postgres
   ```

3. **Configure environment (REQUIRED):**
   ```bash
   cd backend
   # .env must include:
   # - PRIVATE_KEY: Hex-encoded private key for funded Polygon wallet (REQUIRED)
   # - POLYGON_RPC_URL: Your Polygon RPC endpoint
   # All reimbursements are real on-chain ERC20 token transfers
   ```

4. **Run migrations:**
   ```bash
   cd backend
   npx prisma migrate dev --name init
   ```

5. **Start servers:**
   ```bash
   # Terminal 1 - Backend
   cd backend && npm run dev

   # Terminal 2 - Frontend
   cd frontend && npm run dev
   ```

6. **Sync initial data:**
   ```bash
   curl -X POST http://localhost:3003/api/jobs/position-sync/run
   ```

7. **Open dashboard:** http://localhost:3000

## Features

### Core Functionality
- **Real-time Position Sync** - Syncs borrower positions from Morpho every 15 minutes
- **Interest Accrual Engine** - Calculates daily interest with proper APY→APR conversion
- **Reimbursement Processor** - Batch processes reimbursements with on-chain execution
- **Alert System** - Detects APR violations, spikes, and system issues with persistence

### Dashboard Pages
- **Dashboard** (`/`) - Overview metrics, daily charts, recent alerts
- **Markets** (`/markets`) - All markets with status, click for details
- **Market Detail** (`/markets/[id]`) - Positions, APR status, historical data
- **Borrowers** (`/borrowers/[address]`) - Position history, reimbursements
- **Alerts** (`/alerts`) - Alert history with filters, bulk acknowledgement
- **Reimbursements** (`/reimbursements`) - Full history with CSV export

### Production Features
- **Real On-Chain Reimbursements** - All transactions execute on Polygon mainnet with retry logic
- **Live Token Prices** - Fetches real-time prices from CoinGecko for accurate USD valuations
- **Health Checks** - `/api/health` with DB, RPC, and wallet status
- **Alert Persistence** - Stored in DB with acknowledgement workflow
- **Comprehensive Tests** - Unit tests for core business logic

## Configured Markets (Polygon)

| Market | Collateral | Loan Asset | LLTV | APR Cap |
|--------|-----------|------------|------|---------|
| wstETH/WETH | wstETH | WETH | 91.5% | 8% |
| WBTC/USDC | WBTC | USDC | 86% | 10% |
| WPOL/USDC | WPOL | USDC | 77% | 12% |

**Vault Addresses:**
- Compound WETH: `0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF`
- Compound USDT: `0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8`
- Steakhouse USDC: `0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC`

## API Reference

### Health & Metrics
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Comprehensive health check (DB, RPC, wallet) |
| `/api/health/ready` | GET | Kubernetes readiness probe |
| `/api/health/live` | GET | Kubernetes liveness probe |
| `/api/metrics/overview` | GET | System-wide metrics (TVL, borrowers, reimbursements) |
| `/api/metrics/daily` | GET | Daily reimbursement data for charts |
| `/api/metrics/markets` | GET | Per-market breakdown |

### Markets
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/markets` | GET | List all markets |
| `/api/markets/:id` | GET | Market details with positions |
| `/api/markets/:id/borrowers` | GET | Borrowers in a market |

### Borrowers
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/borrowers/:address` | GET | Borrower details, positions, reimbursements |

### Alerts
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/alerts` | GET | Active system alerts |
| `/api/alerts/history` | GET | Historical alerts with filters |
| `/api/alerts/counts` | GET | Alert counts by severity |
| `/api/alerts/stats` | GET | Alert statistics over time |
| `/api/alerts/:id/acknowledge` | POST | Acknowledge single alert |
| `/api/alerts/acknowledge-batch` | POST | Bulk acknowledge alerts |

### Reimbursements
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/reimbursements` | GET | Reimbursement history with filters |
| `/api/reimbursements/summary` | GET | Reimbursement summary stats |

### Jobs (Manual Triggers)
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/jobs` | GET | Status of all scheduled jobs |
| `/api/jobs/position-sync/run` | POST | Sync positions from Morpho |
| `/api/jobs/daily-accrual/run` | POST | Run interest accrual |
| `/api/jobs/daily-reimbursement/run` | POST | Process reimbursements |
| `/api/jobs/run-all` | POST | Run all jobs sequentially |

## Scheduled Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| Position Sync | Every 15 min | Fetches latest positions from Morpho |
| Daily Accrual | 00:00 UTC | Calculates interest for all positions |
| Daily Reimbursement | 01:00 UTC | Processes pending reimbursements |

## Testing

```bash
cd backend
npm test
```

Tests cover:
- Interest calculations (daily accrual, excess computation)
- Reimbursement processing with retry logic
- Alert detection and persistence
- Position sync from Morpho API
- Transaction manager (gas, nonce, retries)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `POLYGON_RPC_URL` | **Yes** | Polygon RPC endpoint (for on-chain transactions) |
| `PRIVATE_KEY` | **Yes** | Wallet private key for reimbursements (64-char hex) |
| `MORPHO_API_URL` | No | Morpho GraphQL API URL |
| `GAS_PRICE_MULTIPLIER` | No | Gas price buffer (default: 1.2) |
| `TX_CONFIRMATIONS` | No | Block confirmations to wait (default: 2) |
| `LOG_LEVEL` | No | Logging level (default: info) |
| `PORT` | No | Backend port (default: 3003) |

## Project Structure

```
gondor-take-home/
├── backend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/          # API endpoints
│   │   │   └── middleware/      # Error handling, validation
│   │   ├── config/              # Constants, database, env
│   │   ├── services/
│   │   │   ├── blockchain/      # Wallet, transaction manager
│   │   │   ├── morpho/          # Morpho GraphQL integration
│   │   │   ├── interest/        # Interest calculations
│   │   │   ├── reimbursement/   # Reimbursement processing
│   │   │   ├── sync/            # Position sync
│   │   │   └── alerts/          # Alert detection & persistence
│   │   └── utils/               # Logger, helpers
│   ├── prisma/                  # Database schema
│   ├── tests/                   # Unit tests
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages
│   │   │   ├── markets/[id]/    # Market detail
│   │   │   ├── borrowers/[addr] # Borrower detail
│   │   │   ├── alerts/          # Alert history
│   │   │   └── reimbursements/  # Reimbursement history
│   │   ├── components/
│   │   │   ├── dashboard/       # Dashboard widgets
│   │   │   ├── charts/          # Chart components
│   │   │   ├── layout/          # Header, navigation
│   │   │   └── ui/              # UI primitives
│   │   ├── hooks/               # Custom React hooks
│   │   └── lib/                 # API client, utilities
│   └── Dockerfile
├── docker-compose.yml           # Docker Compose config
└── README.md
```

## Key Implementation Details

### On-Chain Reimbursements
When `REIMBURSEMENT_ENABLED=true`, the service executes real ERC20 transfers:
- Gas estimation with configurable buffer
- Nonce management for sequential transactions
- Retry logic with exponential backoff
- Transaction confirmation waiting

### APY to APR Conversion
Uses continuous compounding formula: `APR = ln(1 + APY)` for accurate rate conversion.

### Interest Calculation
```typescript
dailyInterest = principal × (APR / 10000) / 365
excessInterest = max(0, actualInterest - cappedInterest)
```

### Token Decimal Handling
- WETH/wstETH: 18 decimals
- USDC/USDT: 6 decimals
- WBTC: 8 decimals

Values are stored in raw units (wei) and converted for display.

## License

Proprietary - Gondor Finance
