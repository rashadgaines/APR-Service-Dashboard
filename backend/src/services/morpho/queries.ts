import { env } from '@/config/env';
import { MARKETS, type MarketKey } from '@/config/constants';
import { Decimal } from 'decimal.js';
import { logger } from '@/utils/logger';

const MORPHO_API_URL = env.MORPHO_API_URL || 'https://blue-api.morpho.org/graphql';

// Query configuration
const QUERY_CONFIG = {
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  TIMEOUT_MS: 15000,
  CACHE_TTL_MS: 30000, // 30 second cache
};

// Simple in-memory cache
const queryCache = new Map<string, { data: unknown; timestamp: number }>();

// GraphQL query for market positions (Polygon chainId = 137)
const GET_MARKET_POSITIONS_QUERY = `
  query GetMarketPositions($marketId: String!) {
    marketPositions(where: { marketUniqueKey_in: [$marketId], chainId_in: [137] }) {
      items {
        user { address }
        borrowShares
        borrowAssets
        collateral
      }
    }
  }
`;

// GraphQL query for market data (Polygon chainId = 137)
const GET_MARKET_QUERY = `
  query GetMarket($marketId: String!) {
    marketByUniqueKey(uniqueKey: $marketId, chainId: 137) {
      loanAsset { symbol decimals }
      collateralAsset { symbol decimals }
      state {
        borrowApy
        supplyApy
        borrowAssets
        supplyAssets
      }
    }
  }
`;

export interface MarketPosition {
  user: { address: string };
  borrowShares: string;
  borrowAssets: string;
  collateral: string;
}

export interface MarketState {
  loanAsset: { symbol: string; decimals: number };
  collateralAsset: { symbol: string; decimals: number };
  state: {
    borrowApy: number;
    supplyApy: number;
    borrowAssets: string;
    supplyAssets: string;
  };
}

export interface PositionData {
  borrower: string;
  borrowed: Decimal;
  collateral: Decimal;
  isActive: boolean;
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate cache key for query + variables
 */
function getCacheKey(query: string, variables: Record<string, unknown>): string {
  return `${query.substring(0, 50)}:${JSON.stringify(variables)}`;
}

/**
 * GraphQL client with retry logic and caching
 */
async function graphqlQuery<T>(
  query: string,
  variables: Record<string, unknown>,
  useCache = true
): Promise<T> {
  const cacheKey = getCacheKey(query, variables);

  // Check cache first
  if (useCache) {
    const cached = queryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < QUERY_CONFIG.CACHE_TTL_MS) {
      logger.debug('Using cached Morpho API response');
      return cached.data as T;
    }
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= QUERY_CONFIG.MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), QUERY_CONFIG.TIMEOUT_MS);

      const response = await fetch(MORPHO_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`GraphQL query failed: ${response.status} ${response.statusText}`);
      }

      const result = (await response.json()) as GraphQLResponse<T>;

      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL errors: ${result.errors.map(e => e.message).join(', ')}`);
      }

      if (!result.data) {
        throw new Error('GraphQL response missing data');
      }

      // Cache successful response
      queryCache.set(cacheKey, { data: result.data, timestamp: Date.now() });

      return result.data;

    } catch (error) {
      lastError = error as Error;

      const isTimeout = lastError.name === 'AbortError';
      const errorType = isTimeout ? 'timeout' : 'error';

      logger.warn(`Morpho API ${errorType} (attempt ${attempt}/${QUERY_CONFIG.MAX_RETRIES}): ${lastError.message}`);

      if (attempt < QUERY_CONFIG.MAX_RETRIES) {
        const delay = QUERY_CONFIG.RETRY_DELAY_MS * attempt;
        await sleep(delay);
      }
    }
  }

  throw lastError || new Error('GraphQL query failed after all retries');
}

/**
 * Get all positions for a specific market
 * Returns empty array if no positions found
 */
export async function getMarketPositions(marketId: string): Promise<PositionData[]> {
  try {
    const data = await graphqlQuery<{ marketPositions: { items: MarketPosition[] } }>(
      GET_MARKET_POSITIONS_QUERY,
      { marketId }
    );

    const items = data?.marketPositions?.items || [];

    return items.map((pos) => ({
      borrower: pos.user.address.toLowerCase(),
      borrowed: new Decimal(pos.borrowAssets || '0'),
      collateral: new Decimal(pos.collateral || '0'),
      isActive: new Decimal(pos.borrowAssets || '0').gt(0),
    }));
  } catch (error) {
    logger.error(`Failed to fetch positions for market ${marketId}:`, error);
    return []; // Return empty array on error to allow other markets to process
  }
}

/**
 * Get market state and APR information
 * Returns null if market data unavailable
 */
export async function getMarketState(marketId: string): Promise<MarketState | null> {
  try {
    const data = await graphqlQuery<{ marketByUniqueKey: MarketState | null }>(
      GET_MARKET_QUERY,
      { marketId }
    );

    if (!data?.marketByUniqueKey) {
      logger.warn(`No market data found for ${marketId}`);
      return null;
    }

    return data.marketByUniqueKey;
  } catch (error) {
    logger.error(`Failed to fetch market state for ${marketId}:`, error);
    return null;
  }
}

/**
 * Convert APY (Annual Percentage Yield) to APR (Annual Percentage Rate)
 * Using continuous compounding formula: APR = ln(1 + APY)
 * This accounts for the compounding effect in the yield
 */
function apyToApr(apy: number): number {
  if (apy <= 0 || isNaN(apy)) return 0;
  // For continuous compounding: APR = ln(1 + APY)
  return Math.log(1 + apy);
}

/**
 * Get APR for a market (returns basis points)
 * Returns 0 if market data unavailable
 */
export async function getMarketAPR(marketId: string): Promise<number> {
  const marketState = await getMarketState(marketId);

  if (!marketState?.state) {
    logger.warn(`No market state for market ${marketId}, returning 0`);
    return 0;
  }

  const apy = marketState.state.borrowApy;
  if (typeof apy !== 'number' || isNaN(apy) || apy <= 0) {
    logger.warn(`Invalid APY value for market ${marketId}: ${apy}`);
    return 0;
  }

  const apr = apyToApr(apy);
  const aprBps = Math.round(apr * 10000); // Convert to basis points
  logger.debug(`Market ${marketId}: APY=${(apy * 100).toFixed(2)}% -> APR=${(apr * 100).toFixed(2)}% (${aprBps} bps)`);
  return aprBps;
}

/**
 * Get all active positions across all configured markets
 * Uses Promise.allSettled to handle partial failures gracefully
 */
export async function getAllActivePositions(): Promise<Array<{ marketId: string; positions: PositionData[] }>> {
  logger.info(`Fetching positions for ${Object.keys(MARKETS).length} markets`);

  const results = await Promise.allSettled(
    Object.values(MARKETS).map(async (market) => {
      const positions = await getMarketPositions(market.id);
      logger.info(`Market ${market.name}: ${positions.length} positions found`);
      return {
        marketId: market.id as string,
        positions,
      };
    })
  );

  const fulfilled: Array<{ marketId: string; positions: PositionData[] }> = [];
  let failedCount = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      fulfilled.push(result.value);
    } else {
      failedCount++;
      logger.error('Market position fetch failed:', result.reason);
    }
  }

  if (failedCount > 0) {
    logger.warn(`${failedCount} market(s) failed to fetch positions`);
  }

  return fulfilled;
}

/**
 * Clear the query cache (useful for testing or manual refresh)
 */
export function clearQueryCache(): void {
  queryCache.clear();
  logger.info('Morpho query cache cleared');
}