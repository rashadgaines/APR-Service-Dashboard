#!/bin/bash

echo "🚀 Setting up Gondor APR Service..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker not found. You'll need to set up PostgreSQL manually."
    echo "   Alternative: Install PostgreSQL locally and create database 'gondor'"
fi

echo "📦 Installing root dependencies..."
npm install

echo "🐘 Starting PostgreSQL database..."
if command -v docker &> /dev/null; then
    # Stop any existing container
    docker stop gondor-postgres 2>/dev/null || true
    docker rm gondor-postgres 2>/dev/null || true

    # Start new container
    docker run --name gondor-postgres \
        -e POSTGRES_PASSWORD=password \
        -e POSTGRES_DB=gondor \
        -p 5432:5432 \
        -d postgres:15

    echo "⏳ Waiting for database to be ready..."
    sleep 10
else
    echo "⚠️  Please ensure PostgreSQL is running on port 5432 with database 'gondor'"
fi

echo "🔧 Setting up backend..."
cd backend

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created backend/.env from template"
fi

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Generate Prisma client and run migrations
echo "🗄️  Setting up database..."
npx prisma generate
npx prisma migrate dev --name init

echo "🎨 Setting up frontend..."
cd ../frontend

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install

echo ""
echo "🎉 Setup complete!"
echo ""
echo "To start the development servers:"
echo "  npm run dev"
echo ""
echo "This will start:"
echo "  📊 Frontend: http://localhost:3000"
echo "  🔧 Backend API: http://localhost:3001"
echo ""
echo "Or run individual services:"
echo "  cd backend && npm run dev    # Backend only"
echo "  cd frontend && npm run dev  # Frontend only"
echo ""
echo "To view the demo immediately:"
echo "  open demo.html"
echo ""
echo "Happy coding! 🚀"