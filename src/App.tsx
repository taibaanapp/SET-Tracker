import React, { useState, useEffect, useMemo } from 'react';
import { signIn, logout, fetchStockData } from './firebase';
import { Stock, Trade, PortfolioSummary, User } from './types';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip, 
  Legend,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Trash2, 
  LogOut, 
  ChevronRight, 
  History, 
  PieChart as PieChartIcon, 
  LayoutDashboard,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Briefcase,
  StickyNote,
  Sun,
  Moon,
  RefreshCw,
  Loader2,
  Edit2,
  X,
  AlertTriangle,
  Globe,
  BarChart3,
  Clock,
  Eye,
  Settings,
  ChevronDown,
  Calendar,
  MoreVertical,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface ApiErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleApiError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: ApiErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  }
  console.error('API Error: ', JSON.stringify(errInfo));
  alert(errInfo.error);
  throw new Error(JSON.stringify(errInfo));
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    if (res.status === 429) {
      const data = await res.json();
      throw new Error(data.error || 'Too many requests');
    }
    throw new Error(`API Error: ${res.statusText}`);
  }
  return res;
}

// --- Components ---

const StatCard = ({ title, value, subValue, trend, icon: Icon, delay = 0 }: { 
  title: string; 
  value: string; 
  subValue?: string; 
  trend?: { val: string; isPositive: boolean };
  icon: any;
  delay?: number;
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="bg-[var(--bg-surface)] border-thin rounded-xl p-6 relative overflow-hidden group hover:border-[var(--accent)] transition-all duration-500"
  >
    <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--accent)] scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
    
    <div className="flex justify-between items-start mb-4">
      <div className="p-2.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--accent)]">
        <Icon size={20} />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center text-[11px] font-mono font-bold px-2 py-1 rounded-md",
          trend.isPositive ? "bg-green-500/10 text-[var(--green)]" : "bg-red-500/10 text-[var(--red)]"
        )}>
          {trend.isPositive ? <ArrowUpRight size={12} className="mr-1" /> : <ArrowDownRight size={12} className="mr-1" />}
          {trend.val}
        </div>
      )}
    </div>
    
    <div>
      <p className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1">{title}</p>
      <h3 className="text-[28px] font-mono font-bold text-[var(--text-primary)] leading-none">{value}</h3>
      {subValue && <p className="text-[12px] text-[var(--text-secondary)] mt-2">{subValue}</p>}
    </div>
  </motion.div>
);

const MarketItem = ({ label, value, change, isUp }: { label: string; value: string; change: string; isUp: boolean }) => (
  <div className="flex items-center gap-4 px-6 border-r-thin h-full whitespace-nowrap">
    <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">{label}</span>
    <span className="text-[14px] font-mono font-bold text-[var(--text-primary)]">{value}</span>
    <span className={cn(
      "text-[12px] font-mono font-bold flex items-center",
      isUp ? "text-[var(--green)]" : "text-[var(--red)]"
    )}>
      {isUp ? <TrendingUp size={12} className="mr-1" /> : <TrendingDown size={12} className="mr-1" />}
      {change}
    </span>
  </div>
);

const Modal = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-lg bg-[var(--bg-surface)] border-thin rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="px-6 py-4 border-b-thin flex items-center justify-between bg-[var(--bg-elevated)]/30">
            <h3 className="text-lg font-bold">{title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'holdings' | 'history' | 'performance' | 'watchlist'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modals & UI State
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ id: string, symbol: string } | null>(null);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [showConfirmDeleteTrade, setShowConfirmDeleteTrade] = useState<Trade | null>(null);

  // Form States
  const [newStock, setNewStock] = useState({ symbol: '', name: '', avgCost: '', totalShares: '', currentPrice: '', date: format(new Date(), 'yyyy-MM-dd'), highPrice: 0 });
  const [editStockData, setEditStockData] = useState({ symbol: '', name: '', avgCost: '', totalShares: '', currentPrice: '' });
  const [newTrade, setNewTrade] = useState({ type: 'BUY' as 'BUY' | 'SELL' | 'DIVIDEND', shares: '', price: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [editTradeData, setEditTradeData] = useState({ type: 'BUY' as 'BUY' | 'SELL' | 'DIVIDEND', shares: '', price: '', notes: '', date: '' });

  // Market Data
  const [marketData] = useState([
    { label: 'SET Index', value: '1,382.51', change: '+0.42%', isUp: true },
    { label: 'USD/THB', value: '36.42', change: '-0.15%', isUp: false },
    { label: 'Gold', value: '2,178.40', change: '+1.24%', isUp: true },
    { label: 'Oil (WTI)', value: '81.24', change: '+0.85%', isUp: true },
  ]);

  useEffect(() => {
    apiFetch('/api/auth/user')
      .then(res => res.json())
      .then(u => {
        setUser(u);
        setIsAuthReady(true);
        setLoading(false);
      })
      .catch(() => {
        setIsAuthReady(true);
        setLoading(false);
      });

    apiFetch('/api/users/count')
      .then(res => res.json())
      .then(data => setUserCount(data.count))
      .catch(err => console.error('Failed to fetch user count:', err));
  }, []);

  useEffect(() => {
    if (!user) {
      setStocks([]);
      setTrades([]);
      return;
    }

    const fetchData = async () => {
      try {
        const [stocksRes, tradesRes] = await Promise.all([
          apiFetch('/api/stocks'),
          apiFetch('/api/trades')
        ]);
        
        if (stocksRes.ok) setStocks(await stocksRes.json());
        if (tradesRes.ok) setTrades(await tradesRes.json());
      } catch (err) {
        console.error("Fetch Data Error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const filteredStocks = useMemo(() => {
    return stocks.filter(s => 
      s.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [stocks, searchQuery]);

  const summary = useMemo((): PortfolioSummary => {
    let totalValue = 0;
    let totalCost = 0;
    stocks.forEach(s => {
      totalValue += s.totalShares * s.currentPrice;
      totalCost += s.totalShares * s.avgCost;
    });
    const totalProfit = totalValue - totalCost;
    const profitPercentage = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    return { totalValue, totalCost, totalProfit, profitPercentage };
  }, [stocks]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      for (const stock of stocks) {
        const fetchedData = await fetchStockData(stock.symbol);
        if (fetchedData && fetchedData.price > 0) {
          await apiFetch(`/api/stocks/${stock.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentPrice: fetchedData.price,
              lastUpdated: new Date().toISOString()
            })
          });
        }
      }
      const res = await apiFetch('/api/stocks');
      if (res.ok) setStocks(await res.json());
    } catch (err) {
      console.error("Refresh Error:", err);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsFetchingPrice(true);
    try {
      const symbol = newStock.symbol.toUpperCase();
      let currentPrice = Number(newStock.currentPrice);
      let highPrice = newStock.highPrice;
      let name = newStock.name;
      
      if (!currentPrice || highPrice === 0) {
        const fetchedData = await fetchStockData(symbol, newStock.date);
        if (fetchedData) {
          currentPrice = currentPrice || fetchedData.price;
          highPrice = highPrice || fetchedData.high || 0;
          name = name || fetchedData.name;
        }
      }

      const avgCostNum = Number(newStock.avgCost || currentPrice);
      
      if (highPrice > 0 && avgCostNum > highPrice) {
        alert(`Avg Cost (฿${avgCostNum}) cannot exceed the day's high (฿${highPrice})`);
        setIsFetchingPrice(false);
        return;
      }

      const res = await apiFetch('/api/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          name: name || '',
          avgCost: avgCostNum,
          totalShares: Number(newStock.totalShares),
          currentPrice: currentPrice || avgCostNum,
          lastUpdated: new Date().toISOString()
        })
      });
      
      const docData = await res.json();
      
      await apiFetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockId: docData.id,
          type: 'BUY',
          shares: Number(newStock.totalShares),
          price: avgCostNum,
          date: new Date(newStock.date).toISOString(),
          notes: 'Initial purchase'
        })
      });

      setNewStock({ symbol: '', name: '', avgCost: '', totalShares: '', currentPrice: '', date: format(new Date(), 'yyyy-MM-dd'), highPrice: 0 });
      setShowAddStock(false);
      window.location.reload(); 
    } catch (err) {
      console.error("Add Stock Error:", err);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleDeleteStock = async () => {
    if (!showConfirmDelete) return;
    try {
      await apiFetch(`/api/stocks/${showConfirmDelete.id}`, { method: 'DELETE' });
      setShowConfirmDelete(null);
      setStocks(prev => prev.filter(s => s.id !== showConfirmDelete.id));
    } catch (err) {
      console.error("Delete Stock Error:", err);
    }
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingStock) return;
    try {
      await apiFetch(`/api/stocks/${editingStock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: editStockData.symbol.toUpperCase(),
          name: editStockData.name,
          avgCost: Number(editStockData.avgCost),
          totalShares: Number(editStockData.totalShares),
          currentPrice: Number(editStockData.currentPrice),
          lastUpdated: new Date().toISOString()
        })
      });
      setEditingStock(null);
      const res = await apiFetch('/api/stocks');
      if (res.ok) setStocks(await res.json());
    } catch (err) {
      console.error("Update Stock Error:", err);
    }
  };

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedStockId) return;
    const stock = stocks.find(s => s.id === selectedStockId);
    if (!stock) return;

    try {
      const sharesNum = newTrade.type === 'DIVIDEND' ? 1 : Number(newTrade.shares);
      const priceNum = Number(newTrade.price);
      
      let newTotalShares = stock.totalShares;
      let newAvgCost = stock.avgCost;

      if (newTrade.type === 'BUY') {
        const totalCost = (stock.totalShares * stock.avgCost) + (sharesNum * priceNum);
        newTotalShares += sharesNum;
        newAvgCost = totalCost / newTotalShares;
      } else if (newTrade.type === 'SELL') {
        newTotalShares -= sharesNum;
      }

      await apiFetch(`/api/stocks/${selectedStockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalShares: newTotalShares,
          avgCost: newAvgCost,
          lastUpdated: new Date().toISOString()
        })
      });

      await apiFetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockId: selectedStockId,
          type: newTrade.type,
          shares: sharesNum,
          price: priceNum,
          date: new Date(newTrade.date).toISOString(),
          notes: newTrade.notes
        })
      });

      setNewTrade({ type: 'BUY', shares: '', price: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') });
      setSelectedStockId(null);
      setShowAddTrade(false);
      
      const [sRes, tRes] = await Promise.all([apiFetch('/api/stocks'), apiFetch('/api/trades')]);
      if (sRes.ok) setStocks(await sRes.json());
      if (tRes.ok) setTrades(await tRes.json());
    } catch (err) {
      console.error("Add Trade Error:", err);
    }
  };

  const recalculateStock = async (stockId: string) => {
    try {
      const res = await apiFetch('/api/trades');
      const allTrades: Trade[] = await res.json();
      const stockTrades = allTrades.filter(t => t.stockId === stockId);
      stockTrades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      let totalShares = 0;
      let totalCost = 0;
      stockTrades.forEach(t => {
        if (t.type === 'BUY') {
          totalCost += t.shares * t.price;
          totalShares += t.shares;
        } else if (t.type === 'SELL') {
          totalShares -= t.shares;
        }
      });
      const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
      await apiFetch(`/api/stocks/${stockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalShares, avgCost, lastUpdated: new Date().toISOString() })
      });
      const [sRes, tRes] = await Promise.all([apiFetch('/api/stocks'), apiFetch('/api/trades')]);
      if (sRes.ok) setStocks(await sRes.json());
      if (tRes.ok) setTrades(await tRes.json());
    } catch (err) {
      console.error("Recalculate Error:", err);
    }
  };

  const confirmDeleteTrade = async () => {
    if (!showConfirmDeleteTrade) return;
    try {
      const stockId = showConfirmDeleteTrade.stockId;
      await apiFetch(`/api/trades/${showConfirmDeleteTrade.id}`, { method: 'DELETE' });
      await recalculateStock(stockId);
      setShowConfirmDeleteTrade(null);
    } catch (err) {
      console.error("Delete Trade Error:", err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex items-center justify-center">
      <Loader2 className="w-10 h-10 text-[var(--accent)] animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-md w-full">
        <div className="w-20 h-20 bg-[var(--accent)] rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[var(--accent)]/20">
          <TrendingUp className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-bold mb-4 tracking-tight text-white">SET Tracker</h1>
        <p className="text-[var(--text-secondary)] mb-10 leading-relaxed">Professional dark-themed stock portfolio dashboard for Thai investors.</p>
        <button onClick={signIn} className="w-full py-4 font-bold rounded-xl bg-white text-black hover:bg-gray-200 transition-all flex items-center justify-center gap-3 shadow-xl">
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
        <p className="text-[11px] uppercase tracking-[0.2em] font-mono font-bold mt-10 text-[var(--text-secondary)]">Join {userCount} users tracking their wealth</p>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] flex text-[var(--text-primary)]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[220px] bg-[var(--bg-surface)] border-r-thin flex flex-col z-50">
        <div className="p-6 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">SET Tracker</span>
          </div>
          <p className="text-[10px] text-[var(--accent)] font-mono uppercase tracking-widest ml-11">พอร์ตหุ้นพันล้าน</p>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'holdings', icon: Briefcase, label: 'Holdings' },
            { id: 'history', icon: History, label: 'Trade History' },
            { id: 'performance', icon: BarChart3, label: 'Performance' },
            { id: 'watchlist', icon: Eye, label: 'Watchlist' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-[14px] font-medium group",
                activeTab === item.id ? "bg-[var(--accent)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-white"
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t-thin space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-elevated)] border-thin flex items-center justify-center text-[var(--accent)] font-bold">
              {user.displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold truncate">{user.displayName?.split(' ')[0]}</p>
              <p className="text-[11px] text-[var(--text-secondary)] truncate">Investor</p>
            </div>
          </div>
          <div className="flex items-center justify-between px-2">
            <button className="p-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white transition-colors"><Sun size={18} /></button>
            <button onClick={logout} className="p-2 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--red)] transition-colors"><LogOut size={18} /></button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-[220px] flex-1 flex flex-col min-h-screen">
        {/* Market Ticker */}
        <div className="h-12 bg-[var(--bg-deep)] border-b-thin flex items-center overflow-x-auto no-scrollbar">
          <div className="flex items-center h-full animate-marquee">
            {marketData.map((item, i) => <MarketItem key={i} {...item} />)}
            {marketData.map((item, i) => <MarketItem key={`dup-${i}`} {...item} />)}
          </div>
        </div>

        {/* Sticky Topbar */}
        <header className="sticky top-0 z-40 bg-[var(--bg-deep)]/80 backdrop-blur-md border-b-thin px-8 py-4 flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-[20px] font-bold tracking-tight capitalize">{activeTab}</h2>
            <p className="text-[11px] font-mono text-[var(--text-secondary)] uppercase tracking-wider">{format(new Date(), 'EEEE, MMMM do yyyy')}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] group-focus-within:text-[var(--accent)] transition-colors" size={16} />
              <input type="text" placeholder="Search stocks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="bg-[var(--bg-surface)] border-thin rounded-lg pl-10 pr-4 py-2 text-[13px] focus:outline-none focus:border-[var(--accent)] transition-all w-[240px]" />
            </div>
            <button onClick={handleRefresh} className="p-2.5 rounded-lg bg-[var(--bg-surface)] border-thin text-[var(--text-secondary)] hover:text-white transition-all">
              <RefreshCw size={18} className={isRefreshing ? 'animate-rotate' : ''} />
            </button>
            <button onClick={() => setShowAddStock(true)} className="bg-[var(--accent)] hover:bg-[var(--accent)]/90 text-white px-5 py-2.5 rounded-lg text-[13px] font-bold flex items-center gap-2 transition-all shadow-lg shadow-[var(--accent)]/20">
              <Plus size={18} />
              <span>เพิ่มหุ้น</span>
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="มูลค่าพอร์ต" value={`฿${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} subValue="Total Portfolio Value" icon={Wallet} delay={0.1} />
                <StatCard title="กำไร/ขาดทุน" value={`${summary.totalProfit >= 0 ? '+' : ''}฿${summary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} subValue={`${summary.profitPercentage.toFixed(2)}% Total Return`} trend={{ val: `${summary.profitPercentage.toFixed(2)}%`, isPositive: summary.totalProfit >= 0 }} icon={TrendingUp} delay={0.2} />
                <StatCard title="หุ้นในพอร์ต" value={stocks.filter(s => s.totalShares > 0).length.toString()} subValue="Active Holdings" icon={Briefcase} delay={0.3} />
                <StatCard title="จำนวนธุรกรรม" value={trades.length.toString()} subValue="Total Transactions" icon={Clock} delay={0.4} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-[var(--bg-surface)] border-thin rounded-xl p-6 flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[16px] font-bold flex items-center gap-2"><PieChartIcon size={18} className="text-[var(--accent)]" />Asset Allocation</h3>
                  </div>
                  {stocks.filter(s => s.totalShares > 0).length > 0 ? (
                    <div className="flex-1 min-h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={stocks.filter(s => s.totalShares > 0).map(s => ({ name: s.symbol, value: s.totalShares * s.currentPrice }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {stocks.filter(s => s.totalShares > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={[`#f97316`, `#3b82f6`, `#10b981`, `#f59e0b`, `#8b5cf6`, `#ec4899`][index % 6]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: '#1a1e25', border: '1px solid #2a2e35', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                            formatter={(value: number) => `฿${value.toLocaleString()}`}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center border-thin border-dashed rounded-xl bg-[var(--bg-deep)]/50 p-10 text-center">
                      <div className="w-16 h-16 rounded-full border-thin border-dashed flex items-center justify-center text-[var(--text-secondary)] mb-4"><PieChartIcon size={32} strokeWidth={1} /></div>
                      <p className="text-[14px] text-[var(--text-secondary)] max-w-[240px]">ยังไม่มีข้อมูลการจัดสรรสินทรัพย์ กรุณาเพิ่มหุ้นเข้าพอร์ตเพื่อดูสัดส่วน</p>
                    </div>
                  )}
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-[var(--bg-surface)] border-thin rounded-xl p-6 flex flex-col min-h-[400px]">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-[16px] font-bold flex items-center gap-2"><TrendingUp size={18} className="text-[var(--green)]" />Top Performers</h3>
                  </div>
                  <div className="space-y-4">
                    {filteredStocks.filter(s => s.totalShares > 0).sort((a, b) => (b.currentPrice - b.avgCost) / b.avgCost - (a.currentPrice - a.avgCost) / a.avgCost).slice(0, 4).map((stock, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl bg-[var(--bg-elevated)]/50 border-thin hover:border-[var(--accent)]/30 transition-all cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[var(--bg-deep)] flex items-center justify-center font-mono font-bold text-[13px] group-hover:text-[var(--accent)] transition-colors">{stock.symbol[0]}</div>
                          <div>
                            <p className="text-[14px] font-bold font-mono">{stock.symbol}</p>
                            <p className="text-[11px] text-[var(--text-secondary)]">{stock.name}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-mono font-bold">฿{stock.currentPrice.toLocaleString()}</p>
                          <p className={cn("text-[12px] font-mono font-bold", stock.currentPrice >= stock.avgCost ? "text-[var(--green)]" : "text-[var(--red)]")}>
                            {(((stock.currentPrice - stock.avgCost) / stock.avgCost) * 100).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            </>
          )}

          {activeTab === 'holdings' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-[var(--bg-surface)] border-thin rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)]/50 text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="px-6 py-4 font-bold">Stock</th>
                      <th className="px-6 py-4 font-bold">Shares</th>
                      <th className="px-6 py-4 font-bold">Avg Cost</th>
                      <th className="px-6 py-4 font-bold">Price</th>
                      <th className="px-6 py-4 font-bold">Value</th>
                      <th className="px-6 py-4 font-bold">Profit/Loss</th>
                      <th className="px-6 py-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredStocks.filter(s => s.totalShares > 0).map((stock) => {
                      const value = stock.totalShares * stock.currentPrice;
                      const cost = stock.totalShares * stock.avgCost;
                      const profit = value - cost;
                      const profitPct = (profit / cost) * 100;
                      return (
                        <tr key={stock.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-[var(--bg-elevated)] flex items-center justify-center font-mono font-bold text-[12px]">{stock.symbol[0]}</div>
                              <div>
                                <p className="font-bold font-mono">{stock.symbol}</p>
                                <p className="text-[11px] text-[var(--text-secondary)]">{stock.name}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-[13px]">{stock.totalShares.toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-[13px]">฿{stock.avgCost.toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-[13px]">฿{stock.currentPrice.toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-[13px]">฿{value.toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <div className={cn("font-mono text-[13px] font-bold", profit >= 0 ? "text-[var(--green)]" : "text-[var(--red)]")}>
                              {profit >= 0 ? '+' : ''}{profit.toLocaleString()}<br/>
                              <span className="text-[11px] opacity-80">{profitPct.toFixed(2)}%</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setSelectedStockId(stock.id); setShowAddTrade(true); }} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--accent)]"><Plus size={16} /></button>
                              <button onClick={() => { setEditingStock(stock); setEditStockData({ symbol: stock.symbol, name: stock.name || '', avgCost: stock.avgCost.toString(), totalShares: stock.totalShares.toString(), currentPrice: stock.currentPrice.toString() }); }} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg text-blue-400"><Edit2 size={16} /></button>
                              <button onClick={() => setShowConfirmDelete({ id: stock.id, symbol: stock.symbol })} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--red)]"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {activeTab === 'history' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="bg-[var(--bg-surface)] border-thin rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[var(--bg-elevated)]/50 text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)]">
                      <th className="px-6 py-4 font-bold">Date</th>
                      <th className="px-6 py-4 font-bold">Stock</th>
                      <th className="px-6 py-4 font-bold">Type</th>
                      <th className="px-6 py-4 font-bold">Shares</th>
                      <th className="px-6 py-4 font-bold">Price</th>
                      <th className="px-6 py-4 font-bold">Total</th>
                      <th className="px-6 py-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((trade) => {
                      const stock = stocks.find(s => s.id === trade.stockId);
                      return (
                        <tr key={trade.id} className="hover:bg-[var(--bg-elevated)]/30 transition-colors group">
                          <td className="px-6 py-4 text-[13px] text-[var(--text-secondary)] font-mono">{format(new Date(trade.date), 'dd/MM/yyyy')}</td>
                          <td className="px-6 py-4 font-bold font-mono">{stock?.symbol || 'Unknown'}</td>
                          <td className="px-6 py-4">
                            <span className={cn("text-[11px] font-bold px-2 py-1 rounded uppercase", trade.type === 'BUY' ? "bg-green-500/10 text-[var(--green)]" : trade.type === 'SELL' ? "bg-red-500/10 text-[var(--red)]" : "bg-blue-500/10 text-blue-400")}>
                              {trade.type}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[13px]">{trade.shares.toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-[13px]">฿{trade.price.toLocaleString()}</td>
                          <td className="px-6 py-4 font-mono text-[13px]">฿{(trade.shares * trade.price).toLocaleString()}</td>
                          <td className="px-6 py-4">
                            <button onClick={() => setShowConfirmDeleteTrade(trade)} className="p-2 hover:bg-[var(--bg-elevated)] rounded-lg text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
          {activeTab === 'performance' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-[var(--bg-surface)] border-thin rounded-xl p-6">
                  <h3 className="text-lg font-bold mb-6">Portfolio Growth</h3>
                  <div className="h-[300px] flex items-center justify-center border-thin border-dashed rounded-xl bg-[var(--bg-deep)]/50 text-[var(--text-secondary)]">
                    <div className="text-center">
                      <BarChart3 size={48} className="mx-auto mb-4 opacity-20" />
                      <p>Historical performance tracking coming soon</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-[var(--bg-surface)] border-thin rounded-xl p-6">
                    <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-[var(--text-secondary)]">Win Rate</h3>
                    <div className="flex items-end gap-2">
                      <span className="text-3xl font-mono font-bold">
                        {trades.filter(t => t.type === 'SELL').length > 0 
                          ? ((trades.filter(t => t.type === 'SELL' && t.price > (stocks.find(s => s.id === t.stockId)?.avgCost || 0)).length / trades.filter(t => t.type === 'SELL').length) * 100).toFixed(1)
                          : '0.0'}%
                      </span>
                      <span className="text-[var(--text-secondary)] text-sm mb-1">of closed trades</span>
                    </div>
                  </div>
                  <div className="bg-[var(--bg-surface)] border-thin rounded-xl p-6">
                    <h3 className="text-sm font-bold mb-4 uppercase tracking-wider text-[var(--text-secondary)]">Best Performer</h3>
                    {stocks.length > 0 ? (
                      <div>
                        <p className="text-2xl font-mono font-bold text-[var(--green)]">
                          {stocks.sort((a, b) => (b.currentPrice - b.avgCost) / b.avgCost - (a.currentPrice - a.avgCost) / a.avgCost)[0].symbol}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)]">
                          +{(((stocks.sort((a, b) => (b.currentPrice - b.avgCost) / b.avgCost - (a.currentPrice - a.avgCost) / a.avgCost)[0].currentPrice - stocks.sort((a, b) => (b.currentPrice - b.avgCost) / b.avgCost - (a.currentPrice - a.avgCost) / a.avgCost)[0].avgCost) / stocks.sort((a, b) => (b.currentPrice - b.avgCost) / b.avgCost - (a.currentPrice - a.avgCost) / a.avgCost)[0].avgCost) * 100).toFixed(2)}%
                        </p>
                      </div>
                    ) : <p className="text-[var(--text-secondary)]">No data</p>}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'watchlist' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">My Watchlist</h3>
                <button className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-surface)] border-thin rounded-lg text-sm hover:border-[var(--accent)] transition-all">
                  <Plus size={16} /> Add Symbol
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {['PTT', 'CPALL', 'AOT'].map((symbol) => (
                  <div key={symbol} className="bg-[var(--bg-surface)] border-thin rounded-xl p-6 hover:border-[var(--accent)] transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-lg font-mono font-bold">{symbol}</h4>
                        <p className="text-xs text-[var(--text-secondary)]">SET Index Component</p>
                      </div>
                      <button className="p-2 text-[var(--text-secondary)] hover:text-[var(--red)] opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-2xl font-mono font-bold">฿34.50</p>
                        <p className="text-xs text-[var(--green)] font-bold">+1.25%</p>
                      </div>
                      <div className="h-10 w-24">
                        {/* Sparkline placeholder */}
                        <div className="w-full h-full bg-[var(--green)]/10 rounded flex items-end gap-1 p-1">
                          {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                            <div key={i} className="flex-1 bg-[var(--green)]/40 rounded-t" style={{ height: `${h}%` }} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Modals */}
      <Modal isOpen={showAddStock} onClose={() => setShowAddStock(false)} title="เพิ่มหุ้นใหม่">
        <form onSubmit={handleAddStock} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Symbol</label>
              <input type="text" value={newStock.symbol} onChange={e => setNewStock({...newStock, symbol: e.target.value.toUpperCase()})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Date</label>
              <input type="date" value={newStock.date} onChange={e => setNewStock({...newStock, date: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Shares</label>
              <input type="number" value={newStock.totalShares} onChange={e => setNewStock({...newStock, totalShares: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Avg Cost</label>
              <input type="number" step="0.01" value={newStock.avgCost} onChange={e => setNewStock({...newStock, avgCost: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" />
            </div>
          </div>
          <button type="submit" disabled={isFetchingPrice} className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent)]/90 transition-all flex items-center justify-center gap-2">
            {isFetchingPrice ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            เพิ่มเข้าพอร์ต
          </button>
        </form>
      </Modal>

      <Modal isOpen={showAddTrade} onClose={() => setShowAddTrade(false)} title="บันทึกรายการซื้อขาย">
        <form onSubmit={handleAddTrade} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Type</label>
            <div className="grid grid-cols-3 gap-2">
              {['BUY', 'SELL', 'DIVIDEND'].map(t => (
                <button key={t} type="button" onClick={() => setNewTrade({...newTrade, type: t as any})} className={cn("py-2 rounded-lg border-thin text-[12px] font-bold transition-all", newTrade.type === t ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--bg-deep)] text-[var(--text-secondary)]")}>{t}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Shares</label>
              <input type="number" value={newTrade.shares} onChange={e => setNewTrade({...newTrade, shares: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required={newTrade.type !== 'DIVIDEND'} disabled={newTrade.type === 'DIVIDEND'} />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Price</label>
              <input type="number" step="0.01" value={newTrade.price} onChange={e => setNewTrade({...newTrade, price: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Date</label>
            <input type="date" value={newTrade.date} onChange={e => setNewTrade({...newTrade, date: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
          </div>
          <button type="submit" className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent)]/90 transition-all">บันทึกรายการ</button>
        </form>
      </Modal>

      <Modal isOpen={!!showConfirmDelete} onClose={() => setShowConfirmDelete(null)} title="ยืนยันการลบหุ้น">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 text-[var(--red)] rounded-full flex items-center justify-center mx-auto"><Trash2 size={32} /></div>
          <p className="text-[var(--text-secondary)]">คุณแน่ใจหรือไม่ว่าต้องการลบหุ้น <span className="text-white font-bold">{showConfirmDelete?.symbol}</span> ออกจากพอร์ต? ข้อมูลรายการซื้อขายทั้งหมดที่เกี่ยวข้องจะถูกลบไปด้วย</p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setShowConfirmDelete(null)} className="py-3 rounded-xl bg-[var(--bg-elevated)] font-bold">ยกเลิก</button>
            <button onClick={handleDeleteStock} className="py-3 rounded-xl bg-[var(--red)] text-white font-bold">ยืนยันการลบ</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!showConfirmDeleteTrade} onClose={() => setShowConfirmDeleteTrade(null)} title="ยืนยันการลบรายการ">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 bg-red-500/10 text-[var(--red)] rounded-full flex items-center justify-center mx-auto"><Trash2 size={32} /></div>
          <p className="text-[var(--text-secondary)]">คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? ระบบจะทำการคำนวณต้นทุนเฉลี่ยใหม่โดยอัตโนมัติ</p>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => setShowConfirmDeleteTrade(null)} className="py-3 rounded-xl bg-[var(--bg-elevated)] font-bold">ยกเลิก</button>
            <button onClick={confirmDeleteTrade} className="py-3 rounded-xl bg-[var(--red)] text-white font-bold">ยืนยันการลบ</button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editingStock} onClose={() => setEditingStock(null)} title="แก้ไขข้อมูลหุ้น">
        <form onSubmit={handleUpdateStock} className="space-y-4">
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Name</label>
            <input type="text" value={editStockData.name} onChange={e => setEditStockData({...editStockData, name: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Shares</label>
              <input type="number" value={editStockData.totalShares} onChange={e => setEditStockData({...editStockData, totalShares: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
            </div>
            <div>
              <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Avg Cost</label>
              <input type="number" step="0.01" value={editStockData.avgCost} onChange={e => setEditStockData({...editStockData, avgCost: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-secondary)] mb-1 block">Current Price</label>
            <input type="number" step="0.01" value={editStockData.currentPrice} onChange={e => setEditStockData({...editStockData, currentPrice: e.target.value})} className="w-full bg-[var(--bg-deep)] border-thin rounded-lg px-4 py-2 focus:border-[var(--accent)] outline-none" required />
          </div>
          <button type="submit" className="w-full bg-[var(--accent)] text-white font-bold py-3 rounded-xl hover:bg-[var(--accent)]/90 transition-all">อัปเดตข้อมูล</button>
        </form>
      </Modal>
    </div>
  );
}
