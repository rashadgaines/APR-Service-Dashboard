import 'dotenv/config';
import { z } from 'zod';

// Hex string validation for private key (with or without 0x prefix)
const hexStringSchema = z.string().regex(/^(0x)?[0-9a-fA-F]{64}$/, {
  message: 'PRIVATE_KEY must be a valid 64-character hex string (with optional 0x prefix)',
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url(),
  POLYGON_RPC_URL: z.string().url(),
  MORPHO_API_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  PORT: z.string().transform(Number).default('3001'),
  // Private key for signing reimbursement transactions
  PRIVATE_KEY: hexStringSchema.optional(),
  // Enable on-chain reimbursements (requires PRIVATE_KEY)
  REIMBURSEMENT_ENABLED: z.string().transform(v => v === 'true').default('false'),
  // Gas price multiplier for transactions (e.g., 1.2 = 20% buffer)
  GAS_PRICE_MULTIPLIER: z.string().transform(Number).default('1.2'),
  // Number of block confirmations to wait for
  TX_CONFIRMATIONS: z.string().transform(Number).default('2'),
});

export const env = envSchema.parse(process.env);

// Validate that PRIVATE_KEY is set when reimbursements are enabled
if (env.REIMBURSEMENT_ENABLED && !env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is required when REIMBURSEMENT_ENABLED is true');
}