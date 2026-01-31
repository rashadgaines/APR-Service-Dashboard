import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '@/config/env';
import { API_CONFIG } from '@/config/constants';
import { startScheduler } from '@/services/reimbursement/scheduler';
import { logger } from '@/utils/logger';
import { errorHandler } from '@/api/middleware/error';
import { initializeWallet, isWalletReady, getSignerAddress } from '@/services/blockchain';

// Import routes
import metricsRoutes from '@/api/routes/metrics';
import marketRoutes from '@/api/routes/markets';
import borrowerRoutes from '@/api/routes/borrowers';
import alertRoutes from '@/api/routes/alerts';
import reimbursementRoutes from '@/api/routes/reimbursements';
import jobsRoutes from '@/api/routes/jobs';
import healthRoutes from '@/api/routes/health';

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: API_CONFIG.CORS_ORIGINS,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  const walletReady = isWalletReady();
  const signerAddress = getSignerAddress();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      reimbursementEnabled: env.REIMBURSEMENT_ENABLED,
      walletInitialized: walletReady,
      signerAddress: signerAddress || null,
    },
  });
});

// API routes
app.use('/api/metrics', metricsRoutes);
app.use('/api/markets', marketRoutes);
app.use('/api/borrowers', borrowerRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/reimbursements', reimbursementRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/health', healthRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize wallet for real on-chain transactions (required)
const walletInitialized = initializeWallet();
if (!walletInitialized) {
  logger.error('❌ FATAL: Wallet initialization failed - PRIVATE_KEY must be set and valid');
  logger.error('❌ On-chain reimbursements require a funded Polygon wallet');
  process.exit(1);
}

logger.info(`✅ Wallet initialized: ${getSignerAddress()}`);
logger.info('✅ Real on-chain reimbursements ENABLED - all transactions are live');

// Start server
const server = app.listen(API_CONFIG.PORT, () => {
  logger.info(`🚀 Server running on port ${API_CONFIG.PORT}`);
  logger.info(`📊 Environment: ${env.NODE_ENV}`);
  logger.info(`🔗 CORS Origins: ${API_CONFIG.CORS_ORIGINS.join(', ')}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Start background jobs
startScheduler();

export default app;