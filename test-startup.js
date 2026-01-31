// Test backend startup issues
console.log('🔍 Testing Gondor Backend Startup...\n');

// Test 1: Basic Node.js
console.log('✅ Node.js version:', process.version);

// Test 2: Import basic modules
try {
  console.log('📦 Testing imports...');

  const express = require('express');
  console.log('✅ Express imported');

  const { PrismaClient } = require('@prisma/client');
  console.log('✅ Prisma imported');

  const { createPublicClient } = require('viem');
  console.log('✅ Viem imported');

} catch (error) {
  console.log('❌ Import error:', error.message);
  process.exit(1);
}

// Test 3: Environment variables
console.log('\n🔧 Environment check:');
const required = ['DATABASE_URL', 'POLYGON_RPC_URL'];
const optional = ['MORPHO_API_URL', 'LOG_LEVEL', 'PORT'];

required.forEach(key => {
  if (process.env[key]) {
    console.log(`✅ ${key}: Set`);
  } else {
    console.log(`❌ ${key}: MISSING`);
  }
});

optional.forEach(key => {
  const value = process.env[key] || 'default';
  console.log(`ℹ️  ${key}: ${value}`);
});

// Test 4: Database connection
console.log('\n🗄️  Testing database connection...');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  log: ['error', 'warn']
});

prisma.$connect()
  .then(() => {
    console.log('✅ Database connected');
    return prisma.$disconnect();
  })
  .catch((error) => {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running on port 5432');
  })
  .finally(() => {
    console.log('\n🎯 Startup test complete');
    console.log('💡 If all checks pass, try: cd backend && npm run dev');
  });