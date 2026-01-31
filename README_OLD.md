# Gondor APR Service

Production-ready monitoring and reimbursement system for Morpho lending pools on Polygon. Enforces APR caps by tracking borrower positions, calculating excess interest, and executing on-chain reimbursements.

## Problem Statement

Morpho Blue uses floating interest rates determined by market utilization. Borrowers need predictable APR caps. This system monitors real-time rates and automatically reimburses borrowers when actual APR exceeds their agreed cap.

## Architecture

**Backend** (Node.js/TypeScript)
- Queries Morpho GraphQL API for position data across 3 markets (wstETH/WETH, WBTC/USDC, WPOL/USDC)
- Calculates daily interest accrual and excess amounts above APR caps (8%, 10%, 12%)
- Executes ERC20 reimbursements on Polygon via viem
- Stores audit trail in PostgreSQL (Prisma ORM)
- Exposes REST API for metrics, alerts, and transaction history

**Frontend** (Next.js 14)
- Real-time dashboard with TVL, borrower compliance stats, and reimbursement charts
- Market breakdown and alert monitoring
- Auto-refresh with smart polling (pauses when tab hidden)

**Database** (PostgreSQL)
- Markets, borrowers, positions, interest accruals, reimbursements, alerts
- Indexed for performance, transaction-safe operations

## Quick Start

```bash
./start.sh  # Starts PostgreSQL, backend (port 3003), frontend (port 3000)
```

Manual setup available in three modes: local development, Docker, or Docker Compose. See configuration section below.

## Implementation Details

**Reimbursement Strategy:** Backend-level implementation chosen over contract modification. Morpho Blue contracts are immutable and permissionless - we can't modify them. Backend approach provides flexibility, lower gas costs (batched vs per-tx), and doesn't require user migration. Full analysis in [REIMBURSEMENT_APPROACH.md](./REIMBURSEMENT_APPROACH.md).

**Transaction Safety:**
- Pre-flight balance validation before sending transactions
- Retry logic with exponential backoff for network failures
- 3 block confirmations required
- Gas estimation with 20% buffer
- Transaction hash tracking for on-chain verification

**Data Pipeline:**
1. Position sync (every 15 min) - fetch from Morpho GraphQL
2. Daily accrual (00:00 UTC) - calculate interest and excess
3. Reimbursement processing (01:00 UTC) - execute ERC20 transfers
4. Alert detection - continuous monitoring for APR violations

**Markets Monitored:**
- wstETH/WETH (91.5% LLTV, 8% APR cap) - Vault: `0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF`
- WBTC/USDC (86% LLTV, 10% APR cap) - Vault: `0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC`
- WPOL/USDC (77% LLTV, 12% APR cap) - Vault: `0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8`

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

## ScheReference

**Health & Metrics**
- `GET /health` - Basic health check
- `GET /api/health` - Detailed system health (DB latency, RPC status, wallet balance)
- `GET /api/metrics/overview` - Dashboard overview (TVL, borrower counts, reimbursement totals)
- `GET /api/metrics/daily?days=30` - Historical reimbursement data for charts
- `GET /api/metrics/markets` - Per-market statistics and utilization
ing

```bash
cd backend && npm test
```

75 passing tests across unit, integration, and E2E suites:
- Interest calculation with Decimal.js precision
- Reimbursement processor with transaction batching
- Transaction manager with retry logic and gas estimation
- Position sync with database transactions
- API endpoint validation and error handling
- Full workflow E2E simulation

Test coverage focuses on core business logic and critical paths. Mock Prisma client used for unit tests, in-memory DB for integration tests.
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

## Demo Flow

### 1. Start the Application
```Configuration

**Required Environment Variables:**
```bash
DATABASE_URL="postgresql://user:pass@localhost:5432/gondor"
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY"
PRIVATE_KEY="0x..."  # Funded wallet for reimbursement transactions
```

**Optional:**
```bash
PORT=3003
LOG_LEVEL=info
MORPHO_API_URL="https://blue-api.morpho.org/graphql"
```

## Production Deployment

**Key Considerations:**
- Stateless backend design enables horizontal scaling
- In-memory cache with 3s TTL (can migrate to Redis for multi-instance)
- Database connection pooling (configurable limits)
- Transaction retry with exponential backoff
- Comprehensive error handling prevents cascading failures

**Infrastructure Requirements:**
- PostgreSQL 15+ (managed instance recommended)
- Polygon RPC endpoint (Alchemy/Infura for production reliability)
- Funded wallet with MATIC for gas + reimbursement tokens
- Load balancer with health check support (`/health` endpoint)

**Deployment Process:**
```bash
# Build production images
docker build -t gondor-backend -f backend/Dockerfile .
docker build -t gondor-frontend -f frontend/Dockerfile .

# Run migrations
docker run gondor-backend npm run migrate:deploy

# Deploy with zero downtime (rolling update)
docker service update --image gondor-backend:latest backend
```

**Monitoring & Alerts:**
- Health checks: `/health` (basic), `/api/health` (detailed with latencies)
- Alert on: DB connection failures, RPC errors, low wallet balance, failed reimbursements
- Log aggregation: Structured JSON logs ready for DataDog/Splunk/ELK
- Metrics: Response times, transaction success rate, APR violation counts

Full deployment guide with security checklist, scaling strategy, and cost estimates in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Production deployment, security, scaling, cost optimization
- [REIMBURSEMENT_APPROACH.md](./REIMBURSEMENT_APPROACH.md) - Technical decision rationale for backend vs contract implementation
- [FINAL_SUMMARY.md](./FINAL_SUMMARY.md) - Complete project overview and assessment checklist