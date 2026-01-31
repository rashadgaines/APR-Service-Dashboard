#!/bin/bash

echo "🚀 Starting Gondor APR Service..."

# Check if database is running
if ! docker ps | grep -q gondor-postgres; then
    echo "🐘 Starting PostgreSQL database..."
    docker start gondor-postgres 2>/dev/null || docker run --name gondor-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=gondor -p 5432:5432 -d postgres:15
    echo "⏳ Waiting for database..."
    sleep 5
fi

# Start backend in background
echo "🔧 Starting backend server..."
cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Start frontend in background
echo "🎨 Starting frontend server..."
cd frontend
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo ""
echo "🎉 Gondor APR Service is starting up!"
echo ""
echo "📊 Frontend Dashboard: http://localhost:3000"
echo "🔧 Backend API:        http://localhost:3001"
echo "📋 API Docs:           http://localhost:3001/api/health"
echo ""
echo "📝 Logs:"
echo "  Backend: tail -f backend.log"
echo "  Frontend: tail -f frontend.log"
echo ""
echo "🛑 To stop: kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "Press Ctrl+C to exit this script (services will keep running)"

# Wait for services
wait $BACKEND_PID $FRONTEND_PID