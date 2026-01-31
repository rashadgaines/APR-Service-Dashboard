// API Response Types

export interface MetricsOverview {
  totalBorrowers: number;
  activeBorrowers: number;
  borrowersUnderCap: number;
  borrowersAboveCap: number;
  totalValueLocked: string;
  todayReimbursements: string;
  totalReimbursements: string;
}

export interface DailyReimbursementData {
  date: string;
  amount: string;
  count: number;
}

export interface MarketMetrics {
  markets: Array<{
    id: string;
    name: string;
    totalBorrowed: string;
    borrowerCount: number;
    aboveCapCount: number;
    utilizationRate: string;
  }>;
}

export interface Market {
  id: string;
  name: string;
  collateralAsset: string;
  loanAsset: string;
  lltv: string;
  aprCap: string;
  currentApr: string;
  aprRatio: string;
  totalBorrowed: string;
  borrowerCount: number;
  aboveCapCount: number;
  utilizationRate: string;
}

export interface MarketDetail {
  market: {
    id: string;
    name: string;
    collateralAsset: string;
    loanAsset: string;
    lltv: string;
    aprCap: string;
    currentApr: string;
    totalBorrowed: string;
    borrowerCount: number;
    totalReimbursements: string;
  };
  positions: Array<{
    id: string;
    borrowerAddress: string;
    principal: string;
    collateral: string;
    isActive: boolean;
    openedAt: string;
    closedAt: string | null;
    totalAccrued: string;
    totalExcess: string;
    totalReimbursed: string;
    recentAccruals: any[];
    recentReimbursements: any[];
  }>;
  recentSnapshots: Array<{
    date: string;
    totalBorrowed: string;
    avgApr: string;
    borrowerCount: number;
    aboveCapCount: number;
  }>;
}

export interface Alert {
  id: string;
  type: 'HIGH_APR' | 'ELEVATED_APR' | 'LARGE_REIMBURSEMENT' | 'REIMBURSEMENT_SPIKE' | 'SYNC_FAILURE' | 'REIMBURSEMENT_FAILURE';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  marketId?: string;
  borrowerAddress?: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface AlertsResponse {
  alerts: Alert[];
  total: number;
  breakdown: {
    critical: number;
    warning: number;
    info: number;
  };
}

export interface BorrowerDetail {
  borrower: {
    address: string;
    createdAt: string;
    totalBorrowed: string;
    totalCollateral: string;
    totalExcessInterest: string;
    totalReimbursed: string;
    pendingReimbursement: string;
    activePositions: number;
    totalPositions: number;
  };
  positions: Array<{
    id: string;
    marketId: string;
    marketName: string;
    principal: string;
    collateral: string;
    isActive: boolean;
    openedAt: string;
    closedAt: string | null;
    totalAccrued: string;
    totalExcess: string;
    totalReimbursed: string;
    recentAccruals: any[];
    recentReimbursements: any[];
  }>;
}

export interface Reimbursement {
  id: string;
  positionId: string;
  borrowerAddress: string;
  marketName: string;
  date: string;
  amount: string;
  txHash: string | null;
  status: string;
}

export interface ReimbursementsResponse {
  reimbursements: Reimbursement[];
  total: number;
}