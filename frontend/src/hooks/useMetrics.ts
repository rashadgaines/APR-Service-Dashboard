import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';
import type { MetricsOverview, DailyReimbursementData, MarketMetrics } from '@/types';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const DEFAULT_REFRESH_INTERVAL = 30000; // 30 seconds - more sensible than 3s

async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fetchFn();
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // If it's a connection/resource error, don't retry aggressively
      if (lastError.message.includes('INSUFFICIENT_RESOURCES') ||
          lastError.message.includes('connection') ||
          lastError.message.includes('ERR_')) {
        maxRetries = attempt; // Exit loop after this attempt
      }

      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * attempt;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error(`Failed to fetch after ${maxRetries} attempts`);
}

// Hook to track document visibility for smart polling
function useDocumentVisible() {
  const [isVisible, setIsVisible] = useState(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      setIsVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return isVisible;
}

export function useOverviewMetrics(refreshInterval = DEFAULT_REFRESH_INTERVAL) {
  const [data, setData] = useState<MetricsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisible = useDocumentVisible();

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchWithRetry(
        () => apiClient.getOverview<MetricsOverview>()
      );
      setData(result);
      setLastUpdated(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch overview metrics';
      setError(errorMsg);
      setLoading(false);
    }
  }, []);

  const forceRefetch = useCallback(async () => {
    try {
      const result = await apiClient.getOverviewForce<MetricsOverview>();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      // silent — fall back to existing data
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only poll when document is visible
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isVisible) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval, isVisible]);

  return { data, loading, error, refetch: fetchData, forceRefetch, lastUpdated };
}

export function useDailyMetrics(days = 30, refreshInterval = DEFAULT_REFRESH_INTERVAL) {
  const [data, setData] = useState<{ data: DailyReimbursementData[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisible = useDocumentVisible();

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchWithRetry(
        () => apiClient.getDailyMetrics<{ data: DailyReimbursementData[] }>(days)
      );
      setData(result);
      setLastUpdated(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch daily metrics';
      setError(errorMsg);
      setLoading(false);
    }
  }, [days]);

  const forceRefetch = useCallback(async () => {
    try {
      const result = await apiClient.getDailyMetricsForce<{ data: DailyReimbursementData[] }>(days);
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      // silent
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only poll when document is visible
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isVisible) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval, isVisible]);

  return { data, loading, error, forceRefetch, lastUpdated };
}

export function useMarketMetrics(refreshInterval = DEFAULT_REFRESH_INTERVAL) {
  const [data, setData] = useState<MarketMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisible = useDocumentVisible();

  const fetchData = useCallback(async () => {
    try {
      const result = await fetchWithRetry(
        () => apiClient.getMarketMetrics<MarketMetrics>()
      );
      setData(result);
      setLastUpdated(new Date());
      setError(null);
      setLoading(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch market metrics';
      setError(errorMsg);
      setLoading(false);
    }
  }, []);

  const forceRefetch = useCallback(async () => {
    try {
      const result = await apiClient.getMarketMetricsForce<MarketMetrics>();
      setData(result);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Only poll when document is visible
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isVisible) {
      intervalRef.current = setInterval(fetchData, refreshInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData, refreshInterval, isVisible]);

  return { data, loading, error, forceRefetch, lastUpdated };
}
