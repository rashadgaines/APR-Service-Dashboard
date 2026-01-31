import { createWalletClient, createPublicClient, http, type WalletClient, type PublicClient, type Hex, type Address } from 'viem';
import { polygon } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { env } from '@/config/env';
import { POLYGON_RPC_URL } from '@/config/constants';
import { logger } from '@/utils/logger';

let walletClient: WalletClient | null = null;
let publicClient: PublicClient | null = null;
let signerAddress: Address | null = null;

/**
 * Initialize the wallet client for signing transactions
 * Only initializes if PRIVATE_KEY is configured
 */
export function initializeWallet(): boolean {
  if (!env.PRIVATE_KEY) {
    logger.info('No PRIVATE_KEY configured - wallet not initialized');
    return false;
  }

  try {
    // Ensure private key has 0x prefix
    const privateKey = env.PRIVATE_KEY.startsWith('0x')
      ? env.PRIVATE_KEY as Hex
      : `0x${env.PRIVATE_KEY}` as Hex;

    const account = privateKeyToAccount(privateKey);
    signerAddress = account.address;

    publicClient = createPublicClient({
      chain: polygon,
      transport: http(POLYGON_RPC_URL),
    });

    walletClient = createWalletClient({
      account,
      chain: polygon,
      transport: http(POLYGON_RPC_URL),
    });

    logger.info(`Wallet initialized with address: ${signerAddress}`);
    return true;
  } catch (error) {
    logger.error(`Failed to initialize wallet: ${error}`);
    return false;
  }
}

/**
 * Get the wallet client (throws if not initialized)
 */
export function getWalletClient(): WalletClient {
  if (!walletClient) {
    throw new Error('Wallet not initialized. Call initializeWallet() first or configure PRIVATE_KEY.');
  }
  return walletClient;
}

/**
 * Get the public client for read operations
 */
export function getPublicClient(): PublicClient {
  if (!publicClient) {
    // Create a public client even without wallet
    publicClient = createPublicClient({
      chain: polygon,
      transport: http(POLYGON_RPC_URL),
    });
  }
  return publicClient;
}

/**
 * Get the signer address
 */
export function getSignerAddress(): Address | null {
  return signerAddress;
}

/**
 * Check if wallet is initialized and ready
 */
export function isWalletReady(): boolean {
  return walletClient !== null && signerAddress !== null;
}

/**
 * Get wallet balance (native POL)
 */
export async function getWalletBalance(): Promise<bigint> {
  if (!signerAddress) {
    throw new Error('Wallet not initialized');
  }
  const client = getPublicClient();
  return await client.getBalance({ address: signerAddress });
}

/**
 * Get current gas price with optional multiplier
 */
export async function getGasPrice(multiplier: number = 1): Promise<bigint> {
  const client = getPublicClient();
  const gasPrice = await client.getGasPrice();
  if (multiplier === 1) return gasPrice;
  return BigInt(Math.ceil(Number(gasPrice) * multiplier));
}

/**
 * Get current nonce for the signer
 */
export async function getCurrentNonce(): Promise<number> {
  if (!signerAddress) {
    throw new Error('Wallet not initialized');
  }
  const client = getPublicClient();
  return await client.getTransactionCount({ address: signerAddress });
}
