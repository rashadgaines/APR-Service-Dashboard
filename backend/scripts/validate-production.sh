#!/bin/bash

# Production Validation Script for Gondor APR Service
# This script validates that all services are running correctly

set -e

BASE_URL="${BASE_URL:-http://localhost:3003}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3001}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================================"
echo "🔍 Gondor APR Service - Production Validation"
echo "================================================"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

check_endpoint() {
    local name=$1
    local url=$2
    local expected_field=$3

    echo -n "  Checking $name... "

    response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")

    if [ "$response" == "200" ]; then
        if [ -n "$expected_field" ]; then
            body=$(curl -s "$url" 2>/dev/null || echo "{}")
            if echo "$body" | grep -q "$expected_field"; then
                echo -e "${GREEN}✓ PASS${NC}"
                ((PASSED++))
            else
                echo -e "${YELLOW}⚠ WARN${NC} (field '$expected_field' not found)"
                ((WARNINGS++))
            fi
        else
            echo -e "${GREEN}✓ PASS${NC}"
            ((PASSED++))
        fi
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
        ((FAILED++))
    fi
}

check_json_response() {
    local name=$1
    local url=$2

    echo -n "  Checking $name... "

    response=$(curl -s "$url" 2>/dev/null || echo "")

    if [ -z "$response" ]; then
        echo -e "${RED}✗ FAIL${NC} (no response)"
        ((FAILED++))
        return
    fi

    # Check if it's valid JSON
    if echo "$response" | python3 -c "import sys, json; json.load(sys.stdin)" 2>/dev/null; then
        echo -e "${GREEN}✓ PASS${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (invalid JSON)"
        ((FAILED++))
    fi
}

# 1. Health Checks
echo "📋 1. Health Checks"
echo "-------------------"
check_endpoint "Health endpoint" "$BASE_URL/health" "status"
check_endpoint "Liveness probe" "$BASE_URL/api/health/live" "alive"
check_endpoint "Readiness probe" "$BASE_URL/api/health/ready" "ready"
check_endpoint "Detailed health" "$BASE_URL/api/health" "checks"
echo ""

# 2. Metrics Endpoints
echo "📊 2. Metrics Endpoints"
echo "-----------------------"
check_json_response "Overview metrics" "$BASE_URL/api/metrics/overview"
check_json_response "Daily metrics" "$BASE_URL/api/metrics/daily"
check_json_response "Market metrics" "$BASE_URL/api/metrics/markets"
echo ""

# 3. Data Endpoints
echo "📈 3. Data Endpoints"
echo "--------------------"
check_json_response "Markets list" "$BASE_URL/api/markets"
check_json_response "Borrowers list" "$BASE_URL/api/borrowers"
check_json_response "Alerts list" "$BASE_URL/api/alerts"
check_json_response "Reimbursements list" "$BASE_URL/api/reimbursements"
echo ""

# 4. Job Endpoints
echo "⚙️  4. Job Endpoints"
echo "--------------------"
check_endpoint "Job status" "$BASE_URL/api/jobs/status" "jobs"
echo ""

# 5. Frontend Check (optional)
echo "🖥️  5. Frontend Check"
echo "--------------------"
echo -n "  Checking frontend... "
frontend_response=$(curl -s -o /dev/null -w "%{http_code}" "$FRONTEND_URL" 2>/dev/null || echo "000")
if [ "$frontend_response" == "200" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ SKIP${NC} (not running or unreachable)"
fi
echo ""

# 6. Data Validation
echo "🔢 6. Data Validation"
echo "---------------------"

echo -n "  Checking metrics data quality... "
metrics=$(curl -s "$BASE_URL/api/metrics/overview" 2>/dev/null || echo "{}")

total_borrowers=$(echo "$metrics" | python3 -c "import sys, json; print(json.load(sys.stdin).get('totalBorrowers', -1))" 2>/dev/null || echo "-1")
active_borrowers=$(echo "$metrics" | python3 -c "import sys, json; print(json.load(sys.stdin).get('activeBorrowers', -1))" 2>/dev/null || echo "-1")

if [ "$total_borrowers" != "-1" ] && [ "$active_borrowers" != "-1" ]; then
    echo -e "${GREEN}✓ PASS${NC} (borrowers: $total_borrowers total, $active_borrowers active)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARN${NC} (metrics data may be incomplete)"
    ((WARNINGS++))
fi

echo -n "  Checking markets data... "
markets=$(curl -s "$BASE_URL/api/markets" 2>/dev/null || echo "{}")
market_count=$(echo "$markets" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('markets', [])))" 2>/dev/null || echo "0")

if [ "$market_count" -gt 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} ($market_count markets)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARN${NC} (no markets initialized - run position sync)"
    ((WARNINGS++))
fi
echo ""

# Summary
echo "================================================"
echo "📋 Validation Summary"
echo "================================================"
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ All checks passed! System is production-ready.${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  System operational with warnings.${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ Some checks failed. Please review before deploying.${NC}"
    exit 1
fi
