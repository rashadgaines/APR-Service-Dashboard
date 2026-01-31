#!/bin/bash

echo "🔍 Testing Gondor APR Service API..."

# Check if backend is running
echo "1. Checking backend health..."
curl -s http://localhost:3001/health | jq . || echo "❌ Backend not responding"

# Check database connection
echo "2. Checking database status..."
cd backend
npx prisma db pull --force > /dev/null 2>&1 && echo "✅ Database connected" || echo "❌ Database connection failed"

# Test API endpoints
echo "3. Testing API endpoints..."

# Metrics overview
echo "   - Testing metrics overview..."
curl -s http://localhost:3001/api/metrics/overview | jq . 2>/dev/null || echo "❌ Metrics API failed"

# Markets
echo "   - Testing markets..."
curl -s http://localhost:3001/api/markets | jq . 2>/dev/null || echo "❌ Markets API failed"

# Alerts
echo "   - Testing alerts..."
curl -s http://localhost:3001/api/alerts | jq . 2>/dev/null || echo "❌ Alerts API failed"

# Jobs status
echo "   - Testing jobs status..."
curl -s http://localhost:3001/api/jobs | jq . 2>/dev/null || echo "❌ Jobs API failed"

echo ""
echo "💡 If you see errors above, the backend might not be running."
echo "   Start it with: cd backend && npm run dev"