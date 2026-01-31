const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003/api';
const API_TIMEOUT_MS = 8000; // Reduced from 30s to fail faster if backend is down
const HEALTH_CHECK_TIMEOUT = 3000; // Quick check if backend is alive

class ApiClient {
  private baseURL: string;
  private lastHealthCheck = 0;
  private isHealthy = true;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private async checkHealth(): Promise<boolean> {
    const now = Date.now();
    // Cache health check for 5 seconds
    if (now - this.lastHealthCheck < 5000) {
      return this.isHealthy;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT);
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      this.isHealthy = response.ok;
    } catch (error) {
      this.isHealthy = false;
    }
    
    this.lastHealthCheck = now;
    return this.isHealthy;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Quick health check to avoid resource exhaustion
    const isHealthy = await this.checkHealth();
    if (!isHealthy) {
      throw new Error(`Backend service unavailable at ${this.baseURL.replace('/api', '')}`);
    }

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    };

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorBody = '';
        try {
          errorBody = await response.text();
        } catch {
          errorBody = response.statusText;
        }
        throw new Error(
          `API request failed: ${response.status} ${response.statusText}. ${
            errorBody ? `Details: ${errorBody.substring(0, 200)}` : ''
          }`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`API request timeout for ${endpoint} (${API_TIMEOUT_MS}ms)`);
      }
      throw error;
    }
  }

  // Metrics endpoints
  async getOverview<T = unknown>(): Promise<T> {
    return this.request<T>('/metrics/overview');
  }

  async getDailyMetrics<T = unknown>(days = 30): Promise<T> {
    return this.request<T>(`/metrics/daily?days=${days}`);
  }

  async getMarketMetrics<T = unknown>(): Promise<T> {
    return this.request<T>('/metrics/markets');
  }

  // Markets endpoints
  async getMarkets<T = unknown>(): Promise<T> {
    return this.request<T>('/markets');
  }

  async getMarket<T = unknown>(id: string): Promise<T> {
    return this.request<T>(`/markets/${id}`);
  }

  async getMarketBorrowers(id: string) {
    return this.request(`/markets/${id}/borrowers`);
  }

  // Borrowers endpoints
  async getBorrower<T = unknown>(address: string): Promise<T> {
    return this.request<T>(`/borrowers/${address}`);
  }

  // Alerts endpoints
  async getAlerts<T = unknown>(): Promise<T> {
    return this.request<T>('/alerts');
  }

  async getAlertHistory<T = unknown>(options?: {
    limit?: number;
    offset?: number;
    acknowledged?: boolean;
    severity?: string;
    type?: string;
    resolved?: boolean;
  }): Promise<T> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.acknowledged !== undefined) params.append('acknowledged', options.acknowledged.toString());
    if (options?.severity) params.append('severity', options.severity);
    if (options?.type) params.append('type', options.type);
    if (options?.resolved !== undefined) params.append('resolved', options.resolved.toString());

    const query = params.toString();
    return this.request<T>(`/alerts/history${query ? `?${query}` : ''}`);
  }

  async getAlertStats<T = unknown>(days = 7): Promise<T> {
    return this.request<T>(`/alerts/stats?days=${days}`);
  }

  async acknowledgeAlert(id: string) {
    return this.request(`/alerts/${id}/acknowledge`, {
      method: 'POST',
    });
  }

  async acknowledgeAlerts(alertIds: string[]) {
    return this.request('/alerts/acknowledge-batch', {
      method: 'POST',
      body: JSON.stringify({ alertIds }),
    });
  }

  // Reimbursements endpoints
  async getReimbursements<T = unknown>(options?: {
    limit?: number;
    borrowerAddress?: string;
    marketId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<T> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.borrowerAddress) params.append('borrowerAddress', options.borrowerAddress);
    if (options?.marketId) params.append('marketId', options.marketId);
    if (options?.status) params.append('status', options.status);
    if (options?.startDate) params.append('startDate', options.startDate);
    if (options?.endDate) params.append('endDate', options.endDate);

    const query = params.toString();
    return this.request<T>(`/reimbursements${query ? `?${query}` : ''}`);
  }

  async getReimbursementSummary<T = unknown>(days = 30): Promise<T> {
    return this.request<T>(`/reimbursements/summary?days=${days}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);