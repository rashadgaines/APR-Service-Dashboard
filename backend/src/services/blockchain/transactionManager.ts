import {
  encodeFunctionData,
  type Hash,
  type Address,
  type TransactionReceipt,
  parseAbi,
} from 'viem';
import { getWalletClient, getPublicClient, getGasPrice, getCurrentNonce, isWalletReady } from './wallet';
import { TX_CONFIG } from '@/config/constants';
import { env } from '@/config/env';
import { logger } from '@/utils/logger';

// ERC20 transfer ABI
const erc20Abi = parseAbi([
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

export interface TransactionResult {
  success: boolean;
  hash: Hash | null;
  receipt: TransactionReceipt | null;
  error?: string;
  gasUsed?: bigint;
  effectiveGasPrice?: bigint;
}

export interface TransferParams {
  tokenAddress: Address;
  recipientAddress: Address;
  amount: bigint;
}

/**
 * Execute an ERC20 token transfer with retry logic
 */
export async function executeTokenTransfer(params: TransferParams): Promise<TransactionResult> {
  const { tokenAddress, recipientAddress, amount } = params;

  if (!isWalletReady()) {
    return {
      success: false,
      hash: null,
      receipt: null,
      error: 'Wallet not initialized',
    };
  }

  // Validate recipient address
  if (!recipientAddress || recipientAddress === '0x0000000000000000000000000000000000000000') {
    return {
      success: false,
      hash: null,
      receipt: null,
      error: 'Invalid recipient address',
    };
  }

  // Validate amount
  if (amount <= 0n) {
    return {
      success: false,
      hash: null,
      receipt: null,
      error: 'Transfer amount must be greater than zero',
    };
  }

  // Check balance before attempting transfer
  try {
    const { sufficient, balance } = await hasSufficientBalance(tokenAddress, amount);
    if (!sufficient) {
      logger.error(`Insufficient token balance: have ${balance}, need ${amount}`);
      return {
        success: false,
        hash: null,
        receipt: null,
        error: `Insufficient balance: have ${balance}, need ${amount}`,
      };
    }
  } catch (error) {
    logger.warn('Could not verify balance before transfer:', error);
    // Continue anyway - the actual transaction will fail if insufficient
  }

  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt < TX_CONFIG.MAX_RETRIES) {
    attempt++;

    try {
      logger.info(`Attempting token transfer (attempt ${attempt}/${TX_CONFIG.MAX_RETRIES}): ` +
        `${amount} to ${recipientAddress} on token ${tokenAddress}`);

      // Get current gas price with buffer
      const gasPrice = await getGasPrice(env.GAS_PRICE_MULTIPLIER);

      // Encode transfer function data
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipientAddress, amount],
      });

      // Estimate gas
      const gasEstimate = await publicClient.estimateGas({
        account: walletClient.account!,
        to: tokenAddress,
        data,
      });

      // Add buffer to gas estimate
      const gasLimit = BigInt(Math.ceil(Number(gasEstimate) * TX_CONFIG.GAS_LIMIT_BUFFER));

      // Get nonce
      const nonce = await getCurrentNonce();

      logger.debug(`Transaction params: gasPrice=${gasPrice}, gasLimit=${gasLimit}, nonce=${nonce}`);

      // Send transaction
      const hash = await walletClient.sendTransaction({
        account: walletClient.account!,
        to: tokenAddress,
        data,
        gas: gasLimit,
        gasPrice,
        nonce,
        chain: walletClient.chain,
      });

      logger.info(`Transaction submitted: ${hash}`);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: env.TX_CONFIRMATIONS,
        timeout: TX_CONFIG.CONFIRMATION_TIMEOUT_MS,
      });

      if (receipt.status === 'success') {
        logger.info(`Transaction confirmed: ${hash} (block ${receipt.blockNumber}, gas used: ${receipt.gasUsed})`);
        return {
          success: true,
          hash,
          receipt,
          gasUsed: receipt.gasUsed,
          effectiveGasPrice: receipt.effectiveGasPrice,
        };
      } else {
        logger.error(`Transaction reverted: ${hash}`);
        return {
          success: false,
          hash,
          receipt,
          error: 'Transaction reverted',
        };
      }

    } catch (error) {
      lastError = error as Error;
      logger.warn(`Transfer attempt ${attempt} failed: ${error}`);

      // Check if we should retry
      if (attempt < TX_CONFIG.MAX_RETRIES) {
        // Check for specific errors that shouldn't be retried
        const errorMessage = (error as Error).message?.toLowerCase() || '';

        if (errorMessage.includes('insufficient funds')) {
          logger.error('Insufficient funds - not retrying');
          break;
        }

        if (errorMessage.includes('nonce too low')) {
          logger.info('Nonce too low - will retry with fresh nonce');
        }

        // Wait before retry
        logger.info(`Waiting ${TX_CONFIG.RETRY_DELAY_MS}ms before retry...`);
        await sleep(TX_CONFIG.RETRY_DELAY_MS);
      }
    }
  }

  return {
    success: false,
    hash: null,
    receipt: null,
    error: lastError?.message || 'Max retries exceeded',
  };
}

/**
 * Get token balance for an address
 */
export async function getTokenBalance(tokenAddress: Address, accountAddress: Address): Promise<bigint> {
  const publicClient = getPublicClient();

  const balance = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [accountAddress],
  });

  return balance;
}

/**
 * Get token decimals
 */
export async function getTokenDecimals(tokenAddress: Address): Promise<number> {
  const publicClient = getPublicClient();

  const decimals = await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'decimals',
  });

  return decimals;
}

/**
 * Check if the wallet has sufficient balance for a transfer
 */
export async function hasSufficientBalance(
  tokenAddress: Address,
  amount: bigint
): Promise<{ sufficient: boolean; balance: bigint }> {
  const { getSignerAddress } = await import('./wallet');
  const signerAddress = getSignerAddress();

  if (!signerAddress) {
    return { sufficient: false, balance: 0n };
  }

  const balance = await getTokenBalance(tokenAddress, signerAddress);
  return {
    sufficient: balance >= amount,
    balance,
  };
}

/**
 * Estimate gas for a token transfer
 */
export async function estimateTransferGas(params: TransferParams): Promise<bigint> {
  const { tokenAddress, recipientAddress, amount } = params;
  const publicClient = getPublicClient();
  const { getSignerAddress } = await import('./wallet');
  const signerAddress = getSignerAddress();

  if (!signerAddress) {
    throw new Error('Wallet not initialized');
  }

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipientAddress, amount],
  });

  return await publicClient.estimateGas({
    account: signerAddress,
    to: tokenAddress,
    data,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
