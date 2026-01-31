## APR Service Dashboard 

Monitoring and reimbursement system for Morpho lending pools on Polygon. Enforces APR caps by tracking positions, calculating excess interest, and executing on-chain reimbursements.

## Setup

```bash
./start.sh
```

Starts PostgreSQL, backend on :3003, frontend on :3000.

## How It Works

**Problem:** Morpho uses floating interest rates. Borrowers need predictable APR caps.

**Solution:** Daily process that:
1. Syncs borrower positions from Morpho GraphQL API
2. Calculates interest accrual against APR caps (8%, 10%, 12% depending on market)
3. Executes ERC20 transfers to reimburse excess interest on Polygon
4. Stores audit trail and serves real-time dashboard

**Implementation:** Backend-level reimbursements (not contract-level). Morpho contracts are immutable—forking them defeats the purpose. Backend approach: flexible, lower gas costs (batching), no user migration.

## Architecture

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                      Morpho Protocol (Polygon)                                    │
│                   (immutable, permissionless)                                     │
└───────────────────────────────────────────────────┬─────────────────────────────────┘
                               │
                        GraphQL Queries
                    (retry, cache, timeout)
                               │
        ┌───────────────────────┼─────────────┬────────────────────────┐
        │                       │             │                        │
   ┌────▼────┐          ┌──────▼──────┐  ┌──▼─────────────┐
   │ Position │          │   Interest  │  │ Transaction   │
   │  Sync    │          │ Calculator  │  │  Manager      │
   │(15 min)  │          │ (00:00 UTC) │  │ (01:00 UTC)   │
   └────┬─────┘          └──────┬──────┘  └──┬─────────────┘
        │                       │            │
        │ Fetch positions       │ Calculate  │ Execute transfers
        │                       │ excess     │ with retry logic
        │                       │ above caps │
        └───────────┬───────────┼────────────┘
                    │           │
                ┌───▼───────────▼─────────────────┐
                │   PostgreSQL Database           │
                │ ├─ Markets & APR caps           │
                │ ├─ Borrowers & Positions        │
                │ ├─ Interest Accruals            │
                │ ├─ Reimbursements (tx hash)     │
                │ └─ Alerts & History             │
                └───┬───────────┬────────────────┬┘
                    │           │                │
            REST API│           │ Query          │
         (cached 3s)│           │                │
                    │           │                │
        ┌───────────┼───────────┼────────────────┼────────┐
        │           │           │                │        │
    ┌───▼──┐   ┌────▼───────┐  ┌────▼────────────▼────┐
    │Health│   │  Metrics   │  │  Frontend Dashboard  │
    │Check │   │  Alerts    │  │   (Next.js 14)       │
    │      │   │  History   │  │                      │
    └──────┘   └────────────┘  └────┬─────────────────┘
                                    │
                            Real-time charts
                            TVL, borrower stats
                            Smart polling
```

## Key Files

**Backend Logic:**
- [backend/src/services/morpho/queries.ts](backend/src/services/morpho/queries.ts) — Morpho GraphQL queries with retry/cache
- [backend/src/services/interest/calculator.ts](backend/src/services/interest/calculator.ts) — APR cap calculations
- [backend/src/services/blockchain/transactionManager.ts](backend/src/services/blockchain/transactionManager.ts) — On-chain transfers with retry logic
- [backend/src/services/reimbursement/processor.ts](backend/src/services/reimbursement/processor.ts) — Batch reimbursement execution
- [backend/src/api/routes](backend/src/api/routes) — REST endpoints (metrics, alerts, health)

**Tests (75 passing):**
- [backend/tests/unit](backend/tests/unit) — Interest calculator, transaction manager, reimbursement processor
- [backend/tests/integration/api.test.ts](backend/tests/integration/api.test.ts) — API endpoint tests
- [backend/tests/e2e/full-flow.test.ts](backend/tests/e2e/full-flow.test.ts) — Full workflow tests

**Infrastructure:**
- [docker-compose.yml](docker-compose.yml) — Local dev environment (PostgreSQL + services)
- [backend/Dockerfile](backend/Dockerfile) — Backend container
- [frontend/Dockerfile](frontend/Dockerfile) — Frontend container
- [prisma/schema.prisma](backend/prisma/schema.prisma) — Database schema
- [prisma/migrations](backend/prisma/migrations) — Schema migrations

**Configuration:**
- `.env` — Environment variables (DATABASE_URL, POLYGON_RPC_URL, PRIVATE_KEY)

## Markets

- **wstETH/WETH**: 8% APR cap (91.5% LLTV)
- **WBTC/USDC**: 10% APR cap (86% LLTV)  
- **WPOL/USDC**: 12% APR cap (77% LLTV)

## API

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Basic health |
| `GET /api/health` | Detailed health (DB, RPC, wallet latencies) |
| `GET /api/metrics/overview` | Dashboard: TVL, borrower counts, reimbursement totals |
| `GET /api/metrics/daily` | Historical reimbursements for charts |
| `GET /api/metrics/markets` | Per-market statistics |
| `GET /api/alerts` | Alert history |
| `GET /api/reimbursements` | Transaction history |
| `POST /api/jobs/position-sync/run` | Manual sync trigger |
| `POST /api/jobs/daily-accrual/run` | Manual calculation trigger |
| `POST /api/jobs/daily-reimbursement/run` | Manual reimbursement trigger |

Responses cached with 3s TTL. Graceful fallbacks when services unavailable.

## Testing

```bash
cd backend && npm test
```

75 passing tests:
- Interest calculation (Decimal.js precision, APY→APR conversion)
- Reimbursement processor (batching, transaction safety)
- Transaction manager (retry logic, gas estimation, balance validation)
- Position sync (database transactions)
- API endpoints (error handling, edge cases)
- E2E workflow

## Configuration

**Required:**
```bash
DATABASE_URL="postgresql://user:pass@host:5432/gondor"
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/KEY"
PRIVATE_KEY="0x..."  # Funded wallet for gas and reimbursements
```

**Optional:**
```bash
PORT=3003
LOG_LEVEL=info
```

## Transaction Safety

- Pre-flight balance validation before each transfer
- Retry logic: exponential backoff, max 3 attempts
- Nonce management (fresh per transaction)
- Gas estimation + 20% buffer
- 3 block confirmations required
- Transaction hash logged for on-chain verification

## Production

**Key Points:**
- Stateless backend enables horizontal scaling
- Connection pooling for database
- In-memory cache (3s TTL) upgradeable to Redis
- Structured JSON logging for aggregation
- Health endpoints for load balancer checks
- Error handling prevents cascading failures


