import { logger } from '@/utils/logger';
import { Decimal } from 'decimal.js';

// CoinGecko API IDs for tokens
const TOKEN_COINGECKO_IDS: Record<string, string> = {
  WETH: 'ethereum',
  wstETH: 'wrapped-steth',
  WBTC: 'wrapped-bitcoin',
  USDC: 'usd-coin',
  USDT: 'tether',
  WPOL: 'matic-network', // Wrapped POL (MATIC)
  POL: 'matic-network',
};

// Fallback prices when API is unavailable (updated regularly)
const FALLBACK_PRICES: Record<string, number> = {
  WETH: 3200,
  wstETH: 3600,
  WBTC: 95000,
  USDC: 1,
  USDT: 1,
  WPOL: 0.45,
  POL: 0.45,
};

// Cache configuration
const CACHE_DURATION_MS = 60000; // 1 minute cache
const API_TIMEOUT_MS = 5000;
const MAX_RETRIES = 2;

// Cache prices with timestamp
let priceCache: Record<string, { price: number; timestamp: number }> = {};
let lastFetchAttempt = 0;
let consecutiveFailures = 0;

/**
 * Fetch current token prices from CoinGecko API
 */
export async function fetchTokenPrices(tokenSymbols: string[]): Promise<Record<string, number>> {
  try {
    // Check cache first
    const now = Date.now();
    const cachedPrices: Record<string, number> = {};
    const tokensToFetch: string[] = [];

    for (const symbol of tokenSymbols) {
      const cached = priceCache[symbol];
      if (cached && now - cached.timestamp < CACHE_DURATION_MS) {
        cachedPrices[symbol] = cached.price;
      } else {
        tokensToFetch.push(symbol);
      }
    }

    if (tokensToFetch.length === 0) {
      logger.debug('Using cached token prices', { symbols: tokenSymbols });
      return cachedPrices;
    }

    // Build CoinGecko API request
    const geckoIds = tokensToFetch
      .map(symbol => TOKEN_COINGECKO_IDS[symbol])
      .filter(Boolean)
      .join(',');

    if (!geckoIds) {
      logger.warn('No CoinGecko IDs found for tokens, using fallback prices', { symbols: tokensToFetch });
      return getFallbackPrices(tokenSymbols);
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds}&vs_currencies=usd`;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        logger.warn('CoinGecko API request failed, using fallback prices', {
          status: response.status,
        });
        return { ...cachedPrices, ...getFallbackPrices(tokensToFetch) };
      }

      const data = (await response.json()) as Record<string, { usd: number }>;

    // Map response back to token symbols
    const freshPrices: Record<string, number> = {};
    for (const symbol of tokensToFetch) {
      const geckoId = TOKEN_COINGECKO_IDS[symbol];
      if (geckoId && data[geckoId]) {
        const price = data[geckoId].usd;
        freshPrices[symbol] = price;
        priceCache[symbol] = { price, timestamp: now };
      } else {
        // Use fallback if API didn't return price for this token
        logger.warn(`No price data for ${symbol}, using fallback`);
        freshPrices[symbol] = FALLBACK_PRICES[symbol] || 1;
      }
    }

      // Combine with cached prices
      const allPrices = { ...cachedPrices, ...freshPrices };
      logger.debug('Fetched token prices from CoinGecko', { prices: allPrices });
      return allPrices;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn('CoinGecko fetch timeout, using cached/fallback prices');
      } else {
        logger.warn('CoinGecko fetch error, using cached/fallback prices', { error: err });
      }
      return { ...cachedPrices, ...getFallbackPrices(tokensToFetch) };
    }
  } catch (error) {
    logger.error('Error in fetchTokenPrices', { error });
    return getFallbackPrices(tokenSymbols);
  }
}

/**
 * Get a single token price with real-time data
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
  const prices = await fetchTokenPrices([tokenSymbol]);
  return prices[tokenSymbol] || 0;
}

/**
 * Fallback prices when API is unavailable
 * Uses pre-configured FALLBACK_PRICES constant
 */
function getFallbackPrices(symbols: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const symbol of symbols) {
    result[symbol] = FALLBACK_PRICES[symbol] || 0;
  }
  return result;
}

/**
 * Get all fallback prices (for use in metrics when API is slow)
 */
export function getAllFallbackPrices(): Record<string, number> {
  return { ...FALLBACK_PRICES };
}

/**
 * Convert a token amount to USD value using real prices
 */
export async function convertToUSD(amount: Decimal, tokenSymbol: string, decimals: number): Promise<Decimal> {
  const price = await getTokenPrice(tokenSymbol);
  const humanAmount = amount.div(new Decimal(10).pow(decimals));
  return humanAmount.mul(price);
}

/**
 * Get cached prices synchronously (returns empty if no cache)
 * Useful for fast response when prices don't need to be real-time
 */
export function getCachedPrices(): Record<string, number> {
  const now = Date.now();
  const result: Record<string, number> = {};

  for (const [symbol, cached] of Object.entries(priceCache)) {
    if (now - cached.timestamp < CACHE_DURATION_MS * 5) { // Extended validity for sync access
      result[symbol] = cached.price;
    }
  }

  // Merge with fallbacks for any missing
  return { ...FALLBACK_PRICES, ...result };
}

/**
 * Force refresh all known token prices
 */
export async function refreshAllPrices(): Promise<Record<string, number>> {
  const allSymbols = Object.keys(TOKEN_COINGECKO_IDS);
  // Clear cache to force refresh
  priceCache = {};
  return fetchTokenPrices(allSymbols);
}

/**
 * Clear the price cache
 */
export function clearPriceCache(): void {
  priceCache = {};
  consecutiveFailures = 0;
  logger.info('Price cache cleared');
}
