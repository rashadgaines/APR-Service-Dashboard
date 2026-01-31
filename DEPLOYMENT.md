# Production Deployment Guide

## Overview
This guide covers deploying the Gondor APR Service to production with best practices for security, monitoring, and scalability.

## Prerequisites

### Required Services
- PostgreSQL 15+ database
- Polygon RPC endpoint (Alchemy, Infura, or QuickNode recommended)
- Funded Polygon wallet for reimbursements
- Node.js 18+ runtime environment

### Environment Variables

#### Backend (`backend/.env.production`)
```env
# Database (use connection pooling in production)
DATABASE_URL="postgresql://user:password@host:5432/gondor?connection_limit=20"

# Polygon RPC (use dedicated endpoint)
POLYGON_RPC_URL="https://polygon-mainnet.g.alchemy.com/v2/YOUR_API_KEY"

# Wallet (CRITICAL: Use secure key management)
PRIVATE_KEY="0x..." # DO NOT commit - use secrets manager

# API Configuration
PORT=3003
NODE_ENV="production"
LOG_LEVEL="info"

# Optional: Morpho API
MORPHO_API_URL="https://blue-api.morpho.org/graphql"

# Transaction Configuration
TX_CONFIRMATIONS=3
GAS_PRICE_MULTIPLIER=1.2
```

#### Frontend (`frontend/.env.production`)
```env
NEXT_PUBLIC_API_URL="https://api.yourdomain.com/api"
```

## Security Checklist

### 🔒 Critical Security Items
- [ ] Private key stored in secure secrets manager (AWS Secrets, Vault, etc.)
- [ ] Database credentials use strong passwords
- [ ] Database requires SSL connections
- [ ] API CORS origins restricted to production domains
- [ ] Rate limiting enabled on all endpoints
- [ ] Input validation on all user inputs
- [ ] Error messages don't leak sensitive information

### 🔐 Wallet Security
```bash
# Generate production wallet securely
# NEVER generate wallets on production servers
# Use hardware wallet or secure offline environment

# Fund wallet with:
# - MATIC for gas fees (~10-20 MATIC recommended)
# - USDC/WETH for reimbursements (based on expected volume)
```

## Deployment Architecture

### Recommended Infrastructure

```
┌─────────────┐
│   Cloudflare│  ← CDN + DDoS protection
│   or Similar│
└──────┬──────┘
       │
┌──────▼──────────────────────────────────┐
│  Load Balancer (ALB/NGINX)              │
└──────┬──────────────────────────────────┘
       │
       ├──────────────────┬──────────────────┐
       │                  │                  │
┌──────▼─────┐    ┌──────▼─────┐    ┌──────▼─────┐
│  Frontend  │    │  Frontend  │    │  Frontend  │
│  Instance  │    │  Instance  │    │  Instance  │
└────────────┘    └────────────┘    └────────────┘

       │
┌──────▼──────────────────────────────────┐
│  Backend API (3+ instances recommended) │
└──────┬──────────────────────────────────┘
       │
┌──────▼──────┐         ┌─────────────┐
│  PostgreSQL │         │  Monitoring │
│  (managed)  │         │  (Datadog)  │
└─────────────┘         └─────────────┘
```

## Docker Deployment

### Build Production Images

```bash
# Backend
cd backend
docker build -t gondor-backend:latest -f Dockerfile .

# Frontend
cd frontend
docker build -t gondor-frontend:latest -f Dockerfile .
```

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: gondor
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: gondor-backend:latest
    environment:
      DATABASE_URL: postgresql://postgres:${DB_PASSWORD}@postgres:5432/gondor
      POLYGON_RPC_URL: ${POLYGON_RPC_URL}
      PRIVATE_KEY: ${PRIVATE_KEY}
      NODE_ENV: production
    depends_on:
      postgres:
        condition: service_healthy
    restart: always
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1'
          memory: 1G

  frontend:
    image: gondor-frontend:latest
    environment:
      NEXT_PUBLIC_API_URL: https://api.yourdomain.com/api
    restart: always
    deploy:
      replicas: 2
```

## Database Setup

### Initial Migration

```bash
cd backend
npm run migrate:deploy  # Production-safe migrations
npm run seed           # Load initial market data
```

### Database Maintenance

```sql
-- Create indices for performance
CREATE INDEX CONCURRENTLY idx_positions_active ON positions(is_active) WHERE is_active = true;
CREATE INDEX CONCURRENTLY idx_accruals_pending ON interest_accruals(excess_amt) WHERE excess_amt > 0;
CREATE INDEX CONCURRENTLY idx_reimbursements_date ON reimbursements(date DESC);
CREATE INDEX CONCURRENTLY idx_alerts_severity ON alerts(severity, resolved_at);

-- Regular maintenance (run weekly)
VACUUM ANALYZE positions;
VACUUM ANALYZE interest_accruals;
VACUUM ANALYZE reimbursements;
```

## Monitoring & Alerting

### Health Checks

```bash
# Application health
curl https://api.yourdomain.com/health

# Database connectivity
curl https://api.yourdomain.com/api/health

# Expected response:
{
  "status": "healthy",
  "checks": {
    "database": { "status": "ok", "latency": 12 },
    "polygonRpc": { "status": "ok", "latency": 95 },
    "wallet": { "status": "ok", "details": { "balance": "..." } }
  }
}
```

### Critical Alerts to Configure

1. **Database Connection Failures**
   - Alert if >3 consecutive health check failures
   - Page on-call engineer immediately

2. **RPC Endpoint Issues**
   - Alert if latency >2s or failure rate >10%
   - May indicate RPC provider issues

3. **Wallet Balance Low**
   - Alert if MATIC <5 or reimbursement tokens <10% of daily average
   - Prevents failed transactions

4. **Reimbursement Failures**
   - Alert on any failed reimbursement transaction
   - Requires manual investigation

5. **APR Cap Violations**
   - Alert if any market >2x APR cap for >1 hour
   - May indicate market manipulation

### Logging

```bash
# Structured JSON logging in production
{
  "level": "info",
  "timestamp": "2026-01-30T12:00:00Z",
  "service": "gondor-backend",
  "message": "Reimbursement processed",
  "context": {
    "borrower": "0x1234...",
    "amount": "100.5",
    "txHash": "0xabc...",
    "gasUsed": 65432
  }
}

# Log aggregation recommendations:
# - DataDog, Splunk, or ELK stack
# - Retention: 90 days minimum
# - Index on: timestamp, level, service, txHash
```

## Performance Optimization

### Backend Optimizations

```typescript
// Already implemented:
// ✓ In-memory caching (3s TTL for metrics)
// ✓ Background cache refresh
// ✓ Smart polling (pauses when browser hidden)
// ✓ Connection pooling
// ✓ Transaction batching

// Additional production tuning:
// - Increase cache TTL to 5-10s for less critical metrics
// - Use Redis for shared cache across instances
// - Enable database query result caching
```

### Frontend Optimizations

```bash
# Already implemented:
# ✓ Static page generation
# ✓ Code splitting
# ✓ Tree shaking
# ✓ Image optimization

# Production build size:
# - First Load JS: ~82KB (excellent)
# - Page-specific: ~2-4KB
```

## Scaling Considerations

### Horizontal Scaling

```bash
# Backend: Stateless, can scale to N instances
# Database: Use read replicas for reporting queries
# Frontend: CDN + multiple edge locations
```

### Vertical Scaling Triggers

- CPU >70% sustained: Add more backend instances
- Memory >80%: Check for memory leaks, increase instance size
- DB connections >50% of max: Increase connection pool or DB instance

## Backup & Disaster Recovery

### Database Backups

```bash
# Automated daily backups
pg_dump gondor | gzip > gondor_$(date +%Y%m%d).sql.gz

# Retention policy:
# - Daily: 7 days
# - Weekly: 4 weeks
# - Monthly: 12 months

# Test restoration quarterly
```

### Configuration Backups

```bash
# Store in version control (without secrets):
# - docker-compose.yml
# - nginx configs
# - Database schema
# - Environment variable templates
```

## Deployment Process

### Zero-Downtime Deployment

```bash
#!/bin/bash
# deploy.sh

# 1. Build new images
docker build -t gondor-backend:$VERSION -f backend/Dockerfile backend/
docker build -t gondor-frontend:$VERSION -f frontend/Dockerfile frontend/

# 2. Run database migrations (if any)
docker run gondor-backend:$VERSION npm run migrate:deploy

# 3. Rolling update backend
docker service update --image gondor-backend:$VERSION backend

# 4. Rolling update frontend
docker service update --image gondor-frontend:$VERSION frontend

# 5. Verify health
sleep 10
curl -f https://api.yourdomain.com/health || exit 1

echo "✅ Deployment successful: version $VERSION"
```

## Rollback Procedure

```bash
# Emergency rollback
docker service update --image gondor-backend:PREVIOUS_VERSION backend
docker service update --image gondor-frontend:PREVIOUS_VERSION frontend

# Verify
curl https://api.yourdomain.com/health
```

## Production Testing

### Smoke Tests

```bash
# Run after every deployment
./backend/scripts/validate-production.sh

# Checks:
# ✓ Health endpoint responds
# ✓ Database accessible
# ✓ RPC endpoint reachable
# ✓ All metrics endpoints return 200
# ✓ Wallet has sufficient balance
```

### Load Testing

```bash
# Use k6 or Apache Bench
k6 run scripts/load-test.js

# Targets:
# - 100 req/s sustained: No errors
# - p95 latency: <500ms
# - p99 latency: <1s
```

## Compliance & Auditing

### Audit Logging

```sql
-- All reimbursements are logged
SELECT * FROM reimbursements 
WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- Transaction hash allows on-chain verification
SELECT tx_hash, borrower_address, amount, status
FROM reimbursements
WHERE tx_hash IS NOT NULL;
```

### Compliance Reports

```bash
# Generate monthly reimbursement report
npm run reports:monthly

# Outputs:
# - Total reimbursed by market
# - Borrower statistics
# - Transaction success rate
# - Gas costs
```

## Maintenance Windows

### Scheduled Maintenance

```
# Recommended monthly maintenance window:
# - Time: Saturday 02:00-04:00 UTC
# - Duration: Max 2 hours
# - Tasks:
#   - Database vacuum/analyze
#   - Log rotation
#   - Security updates
#   - Performance tuning
```

## Support & On-Call

### Runbook

1. **Database Down**
   - Check connection string
   - Verify database instance is running
   - Check security group/firewall rules
   - Escalate to DBA if unresolved in 15 min

2. **High Error Rate**
   - Check logs for patterns
   - Verify RPC endpoint health
   - Check wallet balance
   - Review recent deployments

3. **Reimbursement Failures**
   - Verify wallet has gas and tokens
   - Check Polygon network status
   - Review transaction logs
   - Manual reimbursement may be needed

## Cost Optimization

### Monthly Cost Estimate (AWS)

```
Frontend (t3.small x2):     $30/month
Backend (t3.medium x3):     $125/month
Database (db.t3.medium):    $80/month
RPC (Alchemy Growth):       $50/month
CloudWatch/Logs:            $20/month
Load Balancer:              $25/month
──────────────────────────
Total:                      ~$330/month
```

### Cost Reduction Tips

- Use reserved instances (30-50% savings)
- Right-size instances based on metrics
- Implement autoscaling for variable load
- Use S3 for log archival (cheaper than CloudWatch)

## Security Incident Response

### In Case of Compromise

1. **Immediate Actions**
   - Rotate private key ASAP
   - Pause reimbursement scheduler
   - Review recent transactions
   - Block suspicious IP addresses

2. **Investigation**
   - Audit all database changes
   - Review access logs
   - Check for unauthorized API access
   - Verify wallet balance and transactions

3. **Recovery**
   - Deploy new wallet with fresh key
   - Update environment variables
   - Resume operations after verification
   - Post-mortem analysis

## Contact Information

```
# Production Issues
On-Call: [Your PagerDuty/OpsGenie Link]
Slack: #gondor-alerts

# Database Issues
DBA: [Contact Info]

# Infrastructure
DevOps: [Contact Info]
```

---

**Last Updated:** 2026-01-30
**Document Version:** 1.0
**Maintained By:** Gondor Engineering Team
