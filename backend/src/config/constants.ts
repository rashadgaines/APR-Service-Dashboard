import { Decimal } from 'decimal.js';

// Polygon RPC URL
export const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com';

// Morpho Blue contract address on Polygon
export const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const;

// Vault addresses from assignment (Polygon)
export const VAULTS = {
  COMPOUND_WETH: '0xF5C81d25ee174d83f1FD202cA94AE6070d073cCF',
  COMPOUND_USDT: '0xfD06859A671C21497a2EB8C5E3fEA48De924D6c8',
  STEAKHOUSE_USDC: '0xAcB0DCe4b0FF400AD8F6917f3ca13E434C9ed6bC',
} as const;

// Market configurations with APR caps (from assignment)
export const MARKETS = {
  WST_ETH_WETH: {
    id: '0xb8ae474af3b91c8143303723618b31683b52e9c86566aa54c06f0bc27906bcae',
    name: 'wstETH/WETH',
    collateralAsset: 'wstETH',
    loanAsset: 'WETH',
    lltv: new Decimal('0.915'), // 91.5% LLTV
    aprCapBps: 800, // 8% APR cap in basis points
    vault: VAULTS.COMPOUND_WETH,
  },
  WBTC_USDC: {
    id: '0x1cfe584af3db05c7f39d60e458a87a8b2f6b5d8c6125631984ec489f1d13553b',
    name: 'WBTC/USDC',
    collateralAsset: 'WBTC',
    loanAsset: 'USDC',
    lltv: new Decimal('0.86'), // 86% LLTV
    aprCapBps: 1000, // 10% APR cap
    vault: VAULTS.STEAKHOUSE_USDC,
  },
  WPOL_USDC: {
    id: '0x7506b33817b57f686e37b87b5d4c5c93fdef4cffd21bbf9291f18b2f29ab0550',
    name: 'WPOL/USDC',
    collateralAsset: 'WPOL',
    loanAsset: 'USDC',
    lltv: new Decimal('0.77'), // 77% LLTV
    aprCapBps: 1200, // 12% APR cap
    vault: VAULTS.STEAKHOUSE_USDC,
  },
} as const;

export type MarketKey = keyof typeof MARKETS;

// Helper to get market by ID
export function getMarketById(marketId: string) {
  return Object.values(MARKETS).find(m => m.id === marketId);
}

// Helper to get vault address for a market
export function getVaultForMarket(marketId: string): string | undefined {
  const market = getMarketById(marketId);
  return market?.vault;
}

// Alert thresholds
export const ALERT_THRESHOLDS = {
  APR_WARNING_MULTIPLIER: 1.5,
  APR_CRITICAL_MULTIPLIER: 2.0,
  DAILY_REIMBURSEMENT_WARNING_USD: 10000,
  DAILY_SPIKE_PERCENT: 50,
} as const;

// Job scheduling intervals
export const JOB_INTERVALS = {
  POSITION_SYNC_MINUTES: 15,
  DAILY_ACCRUAL_HOUR: 0, // Midnight UTC
  DAILY_REIMBURSEMENT_HOUR: 1, // 1 AM UTC
} as const;

// API configuration
export const API_CONFIG = {
  PORT: parseInt(process.env.PORT || '3003'),
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
} as const;

// Database configuration
export const DB_CONFIG = {
  MAX_CONNECTIONS: 10,
  CONNECTION_TIMEOUT: 10000,
} as const;

// Token addresses on Polygon
export const TOKEN_ADDRESSES = {
  WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', // Native USDC
  USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  WBTC: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  WPOL: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Wrapped POL (MATIC)
} as const;

// Map loan assets to token addresses
export const LOAN_ASSET_TO_TOKEN: Record<string, string> = {
  WETH: TOKEN_ADDRESSES.WETH,
  USDC: TOKEN_ADDRESSES.USDC,
  USDT: TOKEN_ADDRESSES.USDT,
  WPOL: TOKEN_ADDRESSES.WPOL,
} as const;

// Token decimals mapping
export const TOKEN_DECIMALS: Record<string, number> = {
  WETH: 18,
  wstETH: 18,
  WBTC: 8,
  USDC: 6,
  USDT: 6,
  WPOL: 18,
  POL: 18,
} as const;

// Token prices in USD (simplified for dashboard demo)
export const TOKEN_PRICES: Record<string, number> = {
  WETH: 2500,
  wstETH: 2800,
  WBTC: 50000,
  USDC: 1,
  USDT: 1,
  WPOL: 0.8,
  POL: 0.8,
} as const;

// Transaction configuration
export const TX_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 5000,
  GAS_LIMIT_BUFFER: 1.2, // 20% buffer on gas estimates
  CONFIRMATION_TIMEOUT_MS: 120000, // 2 minutes
} as const;