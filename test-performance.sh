#!/bin/bash

# Test script to verify API timeout fixes
# Tests that metrics endpoints respond in reasonable time

echo "=== API Performance Test ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3003"
TIMEOUT_THRESHOLD=2000 # 2 seconds for fallback response

test_endpoint() {
  local endpoint=$1
  local label=$2
  
  echo -n "Testing $label... "
  
  start_time=$(date +%s%N)
  response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint" -m 5 2>/dev/null)
  end_time=$(date +%s%N)
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)
  
  response_time=$(( (end_time - start_time) / 1000000 )) # Convert to ms
  
  if [ "$http_code" -eq 200 ]; then
    if [ $response_time -lt $TIMEOUT_THRESHOLD ]; then
      echo -e "${GREEN}✓${NC} ($response_time ms)"
      echo "  Response preview: $(echo "$body" | cut -c1-100)..."
    else
      echo -e "${YELLOW}✓${NC} ($response_time ms - slow)"
      echo "  Response preview: $(echo "$body" | cut -c1-100)..."
    fi
  else
    echo -e "${RED}✗${NC} (HTTP $http_code, $response_time ms)"
  fi
  
  echo ""
}

# Check if backend is running
echo "Checking backend connection..."
if ! curl -s "$BASE_URL/health" > /dev/null 2>&1; then
  echo -e "${RED}✗ Backend not responding at $BASE_URL${NC}"
  echo "Make sure backend is running: npm run dev"
  exit 1
fi
echo -e "${GREEN}✓ Backend is running${NC}"
echo ""

# Test endpoints
test_endpoint "/api/metrics/overview" "Overview Metrics"
test_endpoint "/api/metrics/daily?days=7" "Daily Metrics (7 days)"
test_endpoint "/api/metrics/markets" "Market Metrics"

echo "=== Test Complete ==="
echo ""
echo "Expected behavior:"
echo "  1. All responses < 2 seconds (using fallback prices)"
echo "  2. HTTP 200 on all endpoints"
echo "  3. Check browser console for 'Background price update completed'"
