export interface Stock {
  id: string;
  symbol: string;
  name?: string;
  avgCost: number;
  totalShares: number;
  currentPrice: number;
  lastUpdated: string; // ISO string
  userId: string;
  logoUrl?: string;
  website?: string;
  domain?: string;
  industry?: string;
  pe?: number;
  pbv?: number;
  marketCap?: number;
  freeFloat?: number;
  dividendYield?: number;
  history2Y?: { date: string; price: number }[];
}

export interface Trade {
  id: string;
  stockId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  shares: number;
  price: number;
  date: string; // ISO string
  notes?: string;
  userId: string;
}

export interface User {
  id: string;
  googleId: string;
  displayName: string;
  email: string;
  photoUrl: string;
}

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  profitPercentage: number;
}
