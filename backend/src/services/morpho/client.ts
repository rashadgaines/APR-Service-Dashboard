import { createPublicClient, http } from 'viem';
import { polygon } from 'viem/chains';
import { POLYGON_RPC_URL } from '@/config/constants';

// Create viem public client for Polygon
export const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(POLYGON_RPC_URL),
});

// Test connection
export async function testConnection(): Promise<boolean> {
  try {
    const blockNumber = await polygonClient.getBlockNumber();
    return blockNumber > 0n;
  } catch (error) {
    console.error('Failed to connect to Polygon RPC:', error);
    return false;
  }
}