// Simple test to check if the environment works
console.log('🧪 Testing Gondor APR Service Environment...\n');

// Check Node version
console.log('✅ Node.js version:', process.version);

// Test basic imports
try {
  console.log('✅ Testing basic imports...');
  const express = require('express');
  console.log('✅ Express loaded');

  const { PrismaClient } = require('@prisma/client');
  console.log('✅ Prisma loaded');

  const { createPublicClient } = require('viem');
  console.log('✅ Viem loaded');

} catch (error) {
  console.log('❌ Import error:', error.message);
  process.exit(1);
}

// Test environment variables
console.log('\n🔧 Environment Variables:');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');
console.log('POLYGON_RPC_URL:', process.env.POLYGON_RPC_URL ? '✅ Set' : '❌ Not set');
console.log('MORPHO_API_URL:', process.env.MORPHO_API_URL ? '✅ Set' : '❌ Not set');

// Test database connection
console.log('\n🗄️  Testing Database Connection...');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
    return prisma.$disconnect();
  })
  .then(() => {
    console.log('✅ Database test passed');
    console.log('\n🎉 Environment test completed successfully!');
    console.log('💡 The backend should be able to start now.');
  })
  .catch((error) => {
    console.log('❌ Database connection failed:', error.message);
    console.log('💡 Make sure PostgreSQL is running on port 5432');
    process.exit(1);
  });