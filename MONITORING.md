# Monitoring Dashboard Configuration

This document describes the key metrics to monitor for the Gondor APR Service in production.

## Dashboard Overview

### 1. System Health Dashboard

**Refresh Rate:** Every 30 seconds

#### Metrics
- ✅ **API Availability** (Target: 99.9%)
  - Source: `/health` endpoint
  - Alert if <99% over 5 minutes

- ✅ **Database Connection Health**
  - Source: `/api/health` → `checks.database.status`
  - Alert if status !== "ok" for >1 minute

- ✅ **RPC Endpoint Latency**
  - Source: `/api/health` → `checks.polygonRpc.latency`
  - Alert if >2000ms average over 5 minutes

- ✅ **Wallet Balance**
  - Source: `/api/health` → `checks.wallet.details.balance`
  - Alert if MATIC <5 or reimbursement tokens low

---

### 2. Business Metrics Dashboard

**Refresh Rate:** Every 3 minutes

#### Key Performance Indicators
- 📊 **Total Value Locked (TVL)**
  - Source: `/api/metrics/overview` → `totalValueLocked`
  - Shows market size
  - Alert if drops >20% in 1 hour

- 👥 **Active Borrowers**
  - Source: `/api/metrics/overview` → `activeBorrowers`
  - Tracks user engagement

- ⚠️ **Borrowers Above Cap**
  - Source: `/api/metrics/overview` → `borrowersAboveCap`
  - Alert if >30% of active borrowers
  - Critical if >50%

- 💰 **Daily Reimbursements**
  - Source: `/api/metrics/overview` → `todayReimbursements`
  - Shows reimbursement activity
  - Alert if spike >200% of 7-day average

---

### 3. Alert Monitoring Dashboard

**Refresh Rate:** Every 1 minute

#### Alert Tracking
- 🚨 **Critical Alerts**
  - Source: `/api/alerts` → filter by `severity: "critical"`
  - Immediate page to on-call
  - Examples: APR >2x cap, reimbursement failures

- ⚡ **Warning Alerts**
  - Source: `/api/alerts` → filter by `severity: "warning"`
  - Notify team channel
  - Examples: APR >1.5x cap, wallet balance low

- ℹ️ **Info Alerts**
  - Source: `/api/alerts` → filter by `severity: "info"`
  - Log only, no notifications

#### Alert Breakdown
```json
{
  "critical": 0,    // Target: Always 0
  "warning": 2,     // Target: <5
  "info": 10        // Informational
}
```

---

### 4. Performance Dashboard

**Refresh Rate:** Every 1 minute

#### Response Time Metrics
- ⏱️ **API Response Time (P50/P95/P99)**
  - Target P50: <200ms
  - Target P95: <500ms
  - Target P99: <1000ms

- 📈 **Request Rate**
  - Requests per second by endpoint
  - Identify high-traffic endpoints

- 💾 **Database Query Performance**
  - Slowest queries (>100ms)
  - Query count
  - Connection pool usage

#### Error Rate
- 🔴 **5xx Error Rate**
  - Target: <0.1%
  - Alert if >1% over 5 minutes

- 🟠 **4xx Error Rate**
  - Target: <1%
  - May indicate client issues

---

### 5. Reimbursement Operations Dashboard

**Refresh Rate:** Every 5 minutes

#### Transaction Metrics
- ✅ **Successful Reimbursements (24h)**
  - Source: `/api/reimbursements` → filter by `status: "processed"`
  - Shows system effectiveness

- ❌ **Failed Reimbursements (24h)**
  - Source: `/api/reimbursements` → filter by `status: "failed"`
  - Alert if >5% failure rate
  - Requires investigation

- ⏳ **Pending Reimbursements**
  - Source: `/api/reimbursements` → filter by `status: "pending"`
  - Should be processed within 1 hour

#### Gas Metrics
- ⛽ **Average Gas Used**
  - Track transaction costs
  - Identify optimization opportunities

- 💵 **Total Gas Costs (USD)**
  - Monitor operational expenses

---

### 6. Market Health Dashboard

**Refresh Rate:** Every 5 minutes

#### Per-Market Metrics
Source: `/api/metrics/markets` → `markets[]`

For each market (wstETH/WETH, WBTC/USDC, WPOL/USDC):

- **Total Borrowed (USD)**
  - Market utilization

- **Borrower Count**
  - Market activity

- **Above Cap Count**
  - Borrowers needing reimbursement

- **Utilization Rate**
  - Percentage above cap
  - Alert if >40% for extended period

---

## Alert Configuration Examples

### Critical Alerts (Immediate Response)

```yaml
# Database Down
alert: database_health_critical
condition: checks.database.status != "ok"
duration: 1m
severity: critical
action: page_oncall

# Reimbursement Failures
alert: reimbursement_failure_rate
condition: (failed_reimbursements / total_reimbursements) > 0.05
duration: 5m
severity: critical
action: page_oncall + slack

# Wallet Balance Critical
alert: wallet_matic_low
condition: wallet_balance_matic < 5
severity: critical
action: page_oncall + email
```

### Warning Alerts (Team Notification)

```yaml
# High APR
alert: market_apr_elevated
condition: market_apr > (apr_cap * 1.5)
duration: 15m
severity: warning
action: slack_channel

# Reimbursement Spike
alert: reimbursement_spike
condition: daily_reimbursements > (avg_7day * 2)
severity: warning
action: slack_channel + email

# RPC Latency High
alert: rpc_latency_high
condition: rpc_latency_p95 > 2000
duration: 5m
severity: warning
action: slack_channel
```

---

## Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Gondor APR Service - Production",
    "panels": [
      {
        "title": "System Health",
        "targets": [
          {
            "expr": "gondor_health_status",
            "legendFormat": "{{service}}"
          }
        ]
      },
      {
        "title": "Active Borrowers",
        "targets": [
          {
            "expr": "gondor_active_borrowers",
            "legendFormat": "Active"
          },
          {
            "expr": "gondor_borrowers_above_cap",
            "legendFormat": "Above Cap"
          }
        ]
      },
      {
        "title": "Reimbursement Rate",
        "targets": [
          {
            "expr": "rate(gondor_reimbursements_total[5m])",
            "legendFormat": "{{status}}"
          }
        ]
      },
      {
        "title": "API Response Time",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, gondor_api_request_duration_seconds)",
            "legendFormat": "P95"
          }
        ]
      }
    ]
  }
}
```

---

## CloudWatch Alarms (AWS)

```bash
# CPU Usage
aws cloudwatch put-metric-alarm \
  --alarm-name gondor-backend-cpu-high \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 70 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Memory Usage
aws cloudwatch put-metric-alarm \
  --alarm-name gondor-backend-memory-high \
  --metric-name MemoryUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

---

## Log Queries

### Find Failed Reimbursements
```
fields @timestamp, message, context.borrower, context.error
| filter message = "Reimbursement failed"
| sort @timestamp desc
| limit 100
```

### Track Transaction Gas Costs
```
fields @timestamp, context.gasUsed, context.effectiveGasPrice
| filter message = "Transaction confirmed"
| stats avg(context.gasUsed) as avg_gas, sum(context.gasUsed) as total_gas
```

### Identify Slow Queries
```
fields @timestamp, message, context.latency
| filter context.latency > 1000
| sort context.latency desc
| limit 50
```

---

## SLO Targets

| Metric | Target | Measurement Window |
|--------|--------|-------------------|
| API Availability | 99.9% | 30 days |
| Response Time (P95) | <500ms | 24 hours |
| Reimbursement Success Rate | >99% | 7 days |
| Database Availability | 99.95% | 30 days |
| Alert Response Time | <5 minutes | Always |

---

## On-Call Runbook Links

- [Database Issues](./runbooks/database.md)
- [Reimbursement Failures](./runbooks/reimbursements.md)
- [High Traffic/DDoS](./runbooks/traffic.md)
- [Wallet Compromise](./runbooks/security.md)

---

**Maintained By:** DevOps Team
**Last Updated:** 2026-01-30
**Review Frequency:** Quarterly
