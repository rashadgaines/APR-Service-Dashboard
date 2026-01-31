#!/bin/bash

# Start PostgreSQL
echo "Starting PostgreSQL..."
docker run --name gondor-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=gondor -p 5432:5432 -d postgres:15

# Wait for database
echo "Waiting for database to be ready..."
sleep 10

# Setup backend
echo "Setting up backend..."
cd backend
cp .env.example .env
npx prisma generate
npx prisma migrate dev --name init

# Start backend in background
echo "Starting backend server..."
npm run dev &
BACKEND_PID=$!

# Setup and start frontend
echo "Setting up and starting frontend..."
cd ../frontend
npm install
npm run dev &
FRONTEND_PID=$!

echo "Services starting..."
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"

# Wait a bit
sleep 5

echo "Checking if services are running..."
curl -s http://localhost:3001/health || echo "Backend not ready yet"
curl -s http://localhost:3000 || echo "Frontend not ready yet"

echo ""
echo "🎉 Gondor APR Service should be running!"
echo "📊 Frontend: http://localhost:3000"
echo "🔧 Backend API: http://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for services
wait $BACKEND_PID $FRONTEND_PID