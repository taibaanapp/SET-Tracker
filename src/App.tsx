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
  AlertTriangle
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
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const Card = ({ children, className, theme }: { children: React.ReactNode; className?: string; key?: string; theme: 'dark' | 'light' }) => (
  <div className={cn(
    "border rounded-2xl overflow-hidden shadow-xl transition-all duration-300", 
    theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-200",
    className
  )}>
    {children}
  </div>
);

const StatCard = ({ title, value, subValue, trend, icon: Icon, theme }: { 
  title: string; 
  value: string; 
  subValue?: string; 
  trend?: { val: string; isPositive: boolean };
  icon: any;
  theme: 'dark' | 'light';
}) => (
  <Card theme={theme} className="p-6 flex flex-col justify-between min-h-[160px]">
    <div className="flex justify-between items-start">
      <div className={cn("p-2 rounded-lg transition-colors", theme === 'dark' ? "bg-[#2c2e33]" : "bg-gray-100")}>
        <Icon className={cn("w-5 h-5", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")} />
      </div>
      {trend && (
        <div className={cn("flex items-center text-xs font-medium px-2 py-1 rounded-full", 
          trend.isPositive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
          {trend.isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
          {trend.val}
        </div>
      )}
    </div>
    <div>
      <p className={cn("text-sm font-medium mb-1", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>{title}</p>
      <h3 className={cn("text-2xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>{value}</h3>
      {subValue && <p className={cn("text-xs mt-1", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>{subValue}</p>}
    </div>
  </Card>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [searchResult, setSearchResult] = useState<Stock | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showNotFound, setShowNotFound] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<{ id: string, symbol: string } | null>(null);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [editStockData, setEditStockData] = useState({ symbol: '', name: '', avgCost: '', totalShares: '', currentPrice: '' });
  const [showConfirmDeleteTrade, setShowConfirmDeleteTrade] = useState<Trade | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [editTradeData, setEditTradeData] = useState({ type: 'BUY', shares: '', price: '', date: '', notes: '' });
  
  // Modals & UI State
  const [showAddStock, setShowAddStock] = useState(false);
  const [showSold, setShowSold] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'holdings' | 'history'>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStockId, setExpandedStockId] = useState<string | null>(null);

  // Form States
  const [newStock, setNewStock] = useState({ symbol: '', name: '', avgCost: '', totalShares: '', currentPrice: '', date: format(new Date(), 'yyyy-MM-dd'), highPrice: 0 });
  const [newTrade, setNewTrade] = useState({ type: 'BUY' as 'BUY' | 'SELL', shares: '', price: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') });

  useEffect(() => {
    if (selectedStockId) {
      const stock = stocks.find(s => s.id === selectedStockId);
      if (stock) {
        setIsFetchingPrice(true);
        fetchStockData(stock.symbol).then(data => {
          if (data) {
            setNewTrade(prev => ({ ...prev, price: data.price.toString() }));
          }
        }).finally(() => setIsFetchingPrice(false));
      }
    } else {
      setNewTrade({ type: 'BUY', shares: '', price: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') });
    }
  }, [selectedStockId, stocks]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'dark' | 'light';
    if (savedTheme) setTheme(savedTheme);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    fetch('/api/auth/user')
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
          fetch('/api/stocks'),
          fetch('/api/trades')
        ]);
        
        if (stocksRes.ok) setStocks(await stocksRes.json());
        if (tradesRes.ok) setTrades(await tradesRes.json());
      } catch (err) {
        console.error("Fetch Data Error:", err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Polling as fallback for real-time
    return () => clearInterval(interval);
  }, [user]);

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

  const chartData = useMemo(() => {
    return stocks
      .filter(s => s.totalShares > 0)
      .map(s => ({
        name: s.symbol,
        value: s.totalShares * s.currentPrice
      }))
      .sort((a, b) => b.value - a.value);
  }, [stocks]);

  const filteredStocks = useMemo(() => {
    return stocks.filter(stock => {
      const matchesSearch = stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (stock.name && stock.name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSold = showSold ? true : stock.totalShares > 0;
      return matchesSearch && matchesSold;
    });
  }, [stocks, searchQuery, showSold]);

  const COLORS = ['#F27D26', '#3a1510', '#5A5A40', '#4a4a4a', '#8E9299', '#151619'];

  const handleFetchStockData = async () => {
    if (!newStock.symbol) return;
    setIsFetchingPrice(true);
    try {
      const data = await fetchStockData(newStock.symbol, newStock.date);
      if (data) {
        setNewStock(prev => ({
          ...prev,
          name: data.name || prev.name,
          currentPrice: data.price.toString(),
          highPrice: data.high || 0,
          // If avgCost is empty, default to currentPrice
          avgCost: prev.avgCost || data.price.toString()
        }));
      }
    } catch (err) {
      console.error("Fetch Stock Error:", err);
    } finally {
      setIsFetchingPrice(false);
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
      let website = '';
      let domain = '';
      
      // If currentPrice is still empty, fetch data
      if (!currentPrice || highPrice === 0) {
        const fetchedData = await fetchStockData(symbol, newStock.date);
        if (fetchedData) {
          currentPrice = currentPrice || fetchedData.price;
          highPrice = highPrice || fetchedData.high || 0;
          name = name || fetchedData.name;
          website = fetchedData.website || '';
          domain = fetchedData.domain || '';
        }
      }

      const avgCostNum = Number(newStock.avgCost || currentPrice);
      
      // Validation: price should not exceed high of that day
      if (highPrice > 0 && avgCostNum > highPrice) {
        alert(`Avg Cost (฿${avgCostNum}) cannot exceed the day's high (฿${highPrice})`);
        setIsFetchingPrice(false);
        return;
      }

      const res = await fetch('/api/stocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          name: name || '',
          avgCost: avgCostNum,
          totalShares: Number(newStock.totalShares),
          currentPrice: currentPrice || avgCostNum,
          lastUpdated: new Date().toISOString(),
          website,
          domain
        })
      });
      
      const docData = await res.json();
      
      // Add initial trade log with the specified date
      await fetch('/api/trades', {
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
      // Trigger data refresh
      window.location.reload(); 
    } catch (err) {
      console.error("Add Stock Error:", err);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleRefreshPrices = async () => {
    if (isFetchingPrice) return;
    setIsFetchingPrice(true);
    try {
      for (const stock of stocks) {
        const fetchedData = await fetchStockData(stock.symbol);
        if (fetchedData && fetchedData.price > 0) {
          await fetch(`/api/stocks/${stock.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentPrice: fetchedData.price,
              name: stock.name || fetchedData.name,
              website: stock.website || fetchedData.website,
              domain: stock.domain || fetchedData.domain,
              lastUpdated: new Date().toISOString()
            })
          });
        }
      }
      // Refresh local state
      const res = await fetch('/api/stocks');
      if (res.ok) setStocks(await res.json());
    } catch (err) {
      console.error("Refresh Prices Error:", err);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const data = await fetchStockData(searchQuery.trim());
      if (data && data.price > 0) {
        // Check if stock already exists in portfolio
        const existingStock = stocks.find(s => s.symbol.toUpperCase() === searchQuery.trim().toUpperCase());
        
        const result: Stock = {
          id: existingStock?.id || 'temp',
          symbol: searchQuery.trim().toUpperCase(),
          name: data.name,
          currentPrice: data.price,
          avgCost: existingStock?.avgCost || 0,
          totalShares: existingStock?.totalShares || 0,
          lastUpdated: new Date().toISOString(),
          userId: user?.id || '',
          website: data.website,
          domain: data.domain,
          industry: data.industry,
          pe: data.pe,
          pbv: data.pbv,
          marketCap: data.marketCap,
          freeFloat: data.freeFloat,
          dividendYield: data.dividendYield,
          history2Y: data.history2Y
        };
        
        setSearchResult(result);
        setIsSearchModalOpen(true);
      } else {
        setShowNotFound(true);
      }
    } catch (err) {
      console.error("Search Error:", err);
      setShowNotFound(true);
    } finally {
      setIsSearching(false);
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

      await fetch(`/api/stocks/${selectedStockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalShares: newTotalShares,
          avgCost: newAvgCost,
          lastUpdated: new Date().toISOString()
        })
      }).catch(err => handleApiError(err, OperationType.UPDATE, `stocks/${selectedStockId}`));

      await fetch('/api/trades', {
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
      }).catch(err => handleApiError(err, OperationType.CREATE, 'trades'));

      setNewTrade({ type: 'BUY', shares: '', price: '', notes: '', date: format(new Date(), 'yyyy-MM-dd') });
      setSelectedStockId(null);
      
      // Refresh data
      const [sRes, tRes] = await Promise.all([fetch('/api/stocks'), fetch('/api/trades')]);
      if (sRes.ok) setStocks(await sRes.json());
      if (tRes.ok) setTrades(await tRes.json());
    } catch (err) {
      console.error("Add Trade Error:", err);
      alert("Failed to add trade. Please check your connection.");
    }
  };

  const handleDeleteStock = (id: string, symbol: string) => {
    setShowConfirmDelete({ id, symbol });
  };

  const confirmDelete = async () => {
    if (!showConfirmDelete) return;
    try {
      await fetch(`/api/stocks/${showConfirmDelete.id}`, { method: 'DELETE' });
      setShowConfirmDelete(null);
      setStocks(prev => prev.filter(s => s.id !== showConfirmDelete.id));
    } catch (err) {
      console.error("Delete Stock Error:", err);
    }
  };

  const handleEditClick = (stock: Stock) => {
    setEditingStock(stock);
    setEditStockData({
      symbol: stock.symbol,
      name: stock.name || '',
      avgCost: stock.avgCost.toString(),
      totalShares: stock.totalShares.toString(),
      currentPrice: stock.currentPrice.toString()
    });
  };

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingStock) return;
    setIsFetchingPrice(true);
    try {
      const symbol = editStockData.symbol.toUpperCase();
      let currentPrice = Number(editStockData.currentPrice);
      let name = editStockData.name;
      let website = editingStock.website || '';
      let domain = editingStock.domain || '';
      
      if ((!currentPrice || currentPrice === 0) || (symbol !== editingStock.symbol)) {
        const fetchedData = await fetchStockData(symbol);
        if (fetchedData) {
          currentPrice = fetchedData.price || currentPrice;
          name = name || fetchedData.name;
          website = fetchedData.website || website;
          domain = fetchedData.domain || domain;
        }
      }

      await fetch(`/api/stocks/${editingStock.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          name: name || '',
          avgCost: Number(editStockData.avgCost),
          totalShares: Number(editStockData.totalShares),
          currentPrice: currentPrice,
          lastUpdated: new Date().toISOString(),
          website,
          domain
        })
      });

      setEditingStock(null);
      const res = await fetch('/api/stocks');
      if (res.ok) setStocks(await res.json());
    } catch (err) {
      console.error("Update Stock Error:", err);
    } finally {
      setIsFetchingPrice(false);
    }
  };

  const recalculateStock = async (stockId: string) => {
    try {
      const res = await fetch('/api/trades');
      const allTrades: Trade[] = await res.json();
      const stockTrades = allTrades.filter(t => t.stockId === stockId);
      
      // Sort by date ascending
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
      
      await fetch(`/api/stocks/${stockId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalShares,
          avgCost,
          lastUpdated: new Date().toISOString()
        })
      });

      // Refresh data
      const [sRes, tRes] = await Promise.all([fetch('/api/stocks'), fetch('/api/trades')]);
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
      await fetch(`/api/trades/${showConfirmDeleteTrade.id}`, { method: 'DELETE' });
      await recalculateStock(stockId);
      setShowConfirmDeleteTrade(null);
    } catch (err) {
      console.error("Delete Trade Error:", err);
    }
  };

  const handleUpdateTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingTrade) return;
    try {
      await fetch(`/api/trades/${editingTrade.id}`, {
        method: 'PATCH', // Note: I need to implement PATCH for trades in server.ts if I use it
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: editTradeData.type,
          shares: editTradeData.type === 'DIVIDEND' ? 1 : Number(editTradeData.shares),
          price: Number(editTradeData.price),
          date: new Date(editTradeData.date).toISOString(),
          notes: editTradeData.notes
        })
      });
      await recalculateStock(editingTrade.stockId);
      setEditingTrade(null);
    } catch (err) {
      console.error("Update Trade Error:", err);
    }
  };

  if (loading) return (
    <div className={cn("min-h-screen flex items-center justify-center transition-colors duration-300", 
      theme === 'dark' ? "bg-[#0a0a0a]" : "bg-gray-50")}>
      <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className={cn("min-h-screen flex flex-col items-center justify-center p-4 transition-colors duration-300", 
      theme === 'dark' ? "bg-[#0a0a0a]" : "bg-gray-50")}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-20 h-20 bg-[#F27D26] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-[#F27D26]/20">
          <TrendingUp className="w-10 h-10 text-white" />
        </div>
        <h1 className={cn("text-4xl font-bold mb-4 tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>Thai Stock Tracker</h1>
        <p className={cn("mb-8 leading-relaxed", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
          Monitor your SET portfolio with professional-grade analytics, detailed trade logs, and performance tracking.
        </p>
        <button 
          onClick={signIn}
          className={cn("w-full py-4 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 shadow-xl",
            theme === 'dark' ? "bg-white text-black hover:bg-gray-200" : "bg-gray-900 text-white hover:bg-black")}
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
          Sign in with Google
        </button>
      </motion.div>
    </div>
  );

  return (
    <div className={cn("min-h-screen font-sans selection:bg-[#F27D26]/30 transition-colors duration-300", 
      theme === 'dark' ? "bg-[#0a0a0a] text-white" : "bg-gray-50 text-gray-900")}>
      {/* Sidebar Navigation */}
      <aside className={cn("fixed left-0 top-0 bottom-0 w-20 md:w-64 border-r z-50 flex flex-col transition-colors duration-300", 
        theme === 'dark' ? "bg-[#151619] border-[#2c2e33]" : "bg-white border-gray-200")}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#F27D26] rounded-xl flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <span className={cn("hidden md:block font-bold text-xl tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>SET Tracker</span>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'holdings', icon: Briefcase, label: 'Holdings' },
            { id: 'history', icon: History, label: 'Trade History' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-[#F27D26] text-white" 
                  : (theme === 'dark' ? "text-[#8e9299] hover:bg-[#2c2e33] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900")
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="hidden md:block font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t space-y-2 transition-colors duration-300" style={{ borderColor: theme === 'dark' ? '#2c2e33' : '#e5e7eb' }}>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 transition-colors rounded-xl",
              theme === 'dark' ? "text-[#8e9299] hover:bg-[#2c2e33] hover:text-white" : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="hidden md:block font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          <button 
            onClick={logout}
            className={cn(
              "w-full flex items-center gap-4 px-4 py-3 transition-colors rounded-xl",
              theme === 'dark' ? "text-[#8e9299] hover:text-red-400 hover:bg-red-500/5" : "text-gray-500 hover:text-red-600 hover:bg-red-50"
            )}
          >
            <LogOut className="w-5 h-5" />
            <span className="hidden md:block font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="ml-20 md:ml-64 p-4 md:p-8 pb-24">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className={cn("text-3xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>
              {activeTab === 'dashboard' ? 'Portfolio Overview' : 
               activeTab === 'holdings' ? 'My Holdings' : 'Transaction History'}
            </h2>
            <p className={cn("text-sm mt-1", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
              Welcome back, {user.displayName?.split(' ')[0]}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")} />
              <input 
                type="text" 
                placeholder="Search stocks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeTab === 'dashboard') {
                    handleSearch();
                  }
                }}
                className={cn("border rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#F27D26]/50 transition-all w-full md:w-64",
                  theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33] text-white" : "bg-white border-gray-200 text-gray-900")}
              />
              {activeTab === 'dashboard' && searchQuery && (
                <button 
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin text-[#F27D26]" /> : <Search className="w-4 h-4 text-[#F27D26]" />}
                </button>
              )}
            </div>
            <button
              onClick={handleRefreshPrices}
              disabled={isFetchingPrice}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all",
                theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33] text-[#8e9299] hover:text-white hover:bg-[#2c2e33]" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")}
            >
              {isFetchingPrice ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button 
              onClick={() => setShowAddStock(true)}
              className="bg-[#F27D26] hover:bg-[#d96a1b] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-[#F27D26]/20"
            >
              <Plus className="w-4 h-4" />
              Add Stock
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                theme={theme}
                title="Total Portfolio Value" 
                value={`฿${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                subValue={`฿${summary.totalCost.toLocaleString()} invested`}
                icon={Wallet}
              />
              <StatCard 
                theme={theme}
                title="Total Profit/Loss" 
                value={`${summary.totalProfit >= 0 ? '+' : ''}฿${summary.totalProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                trend={{ val: `${summary.profitPercentage.toFixed(2)}%`, isPositive: summary.totalProfit >= 0 }}
                icon={TrendingUp}
              />
              <StatCard 
                theme={theme}
                title="Active Holdings" 
                value={stocks.filter(s => s.totalShares > 0).length.toString()}
                subValue="Stocks in portfolio"
                icon={Briefcase}
              />
              <StatCard 
                theme={theme}
                title="Total Trades" 
                value={trades.length.toString()}
                subValue="Lifetime transactions"
                icon={History}
              />
            </div>

            {/* Charts & Top Performers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <Card theme={theme} className="lg:col-span-2 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className={cn("text-lg font-bold flex items-center gap-2", theme === 'dark' ? "text-white" : "text-gray-900")}>
                    <PieChartIcon className="w-5 h-5 text-[#F27D26]" />
                    Asset Allocation
                  </h3>
                </div>
                <div className="h-[300px] w-full">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={110}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          contentStyle={{ 
                            backgroundColor: theme === 'dark' ? '#1a1b1e' : '#fff', 
                            border: theme === 'dark' ? '1px solid #2c2e33' : '1px solid #e5e7eb', 
                            borderRadius: '12px' 
                          }}
                          itemStyle={{ color: theme === 'dark' ? '#fff' : '#000' }}
                        />
                        <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className={cn("h-full flex items-center justify-center", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                      No data to display
                    </div>
                  )}
                </div>
              </Card>

              <Card theme={theme} className="p-6">
                <h3 className={cn("text-lg font-bold mb-6 flex items-center gap-2", theme === 'dark' ? "text-white" : "text-gray-900")}>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  Top Performers
                </h3>
                <div className="space-y-4">
                  {stocks
                    .map(s => ({ ...s, profit: (s.currentPrice - s.avgCost) * s.totalShares, pct: ((s.currentPrice - s.avgCost) / s.avgCost) * 100 }))
                    .sort((a, b) => b.pct - a.pct)
                    .slice(0, 5)
                    .map((stock, idx) => (
                      <div key={stock.id} className={cn("flex items-center justify-between p-3 rounded-xl border",
                        theme === 'dark' ? "bg-[#2c2e33]/30 border-transparent" : "bg-gray-50 border-gray-100")}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-[#F27D26]/10 rounded-lg flex items-center justify-center text-[#F27D26] font-bold text-xs">
                            {stock.symbol[0]}
                          </div>
                          <div>
                            <p className={cn("font-bold text-sm", theme === 'dark' ? "text-white" : "text-gray-900")}>{stock.symbol}</p>
                            <p className={cn("text-[10px] uppercase tracking-wider", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>{stock.name || 'Thai Stock'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-bold", stock.pct >= 0 ? "text-green-500" : "text-red-500")}>
                            {stock.pct >= 0 ? '+' : ''}{stock.pct.toFixed(2)}%
                          </p>
                          <p className={cn("text-[10px]", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>฿{stock.profit.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'holdings' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={showSold}
                    onChange={(e) => setShowSold(e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#F27D26]/20 dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-[#F27D26]"></div>
                  <span className={cn("ml-3 text-sm font-medium", theme === 'dark' ? "text-[#8e9299]" : "text-gray-900")}>Show sold</span>
                </label>
              </div>
            </div>
            <Card theme={theme} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1200px]">
                  <thead className={cn("text-[10px] uppercase tracking-widest font-bold", 
                    theme === 'dark' ? "bg-[#151619] text-[#5c5f66]" : "bg-gray-100 text-gray-500")}>
                    <tr>
                      <th className="px-6 py-4">Holding</th>
                      <th className="px-6 py-4 text-right">Shares</th>
                      <th className="px-6 py-4 text-right">Cost basis</th>
                      <th className="px-6 py-4 text-right">Current value</th>
                      <th className="px-6 py-4 text-right">Dividends</th>
                      <th className="px-6 py-4 text-right">Total profit</th>
                      <th className="px-6 py-4 text-right">IRR</th>
                      <th className="px-6 py-4 text-right">Share in portfolio</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={cn("divide-y", theme === 'dark' ? "divide-[#2c2e33]" : "divide-gray-100")}>
                    {filteredStocks.map((stock) => {
                      const totalCost = stock.totalShares * stock.avgCost;
                      const currentValue = stock.totalShares * stock.currentPrice;
                      const totalDividends = trades
                        .filter(t => t.stockId === stock.id && t.type === 'DIVIDEND')
                        .reduce((acc, t) => acc + (t.price * t.shares), 0);
                      const profit = currentValue - totalCost + totalDividends;
                      const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;
                      const portfolioValue = stocks.reduce((acc, s) => acc + (s.totalShares * s.currentPrice), 0);
                      const shareInPortfolio = portfolioValue > 0 ? (currentValue / portfolioValue) * 100 : 0;
                      
                      const isExpanded = expandedStockId === stock.id;
                      const stockTrades = trades
                        .filter(t => t.stockId === stock.id)
                        .sort((a, b) => b.date.toMillis() - a.date.toMillis())
                        .slice(0, 10);

                      return (
                        <React.Fragment key={stock.id}>
                          <tr 
                            onClick={() => setExpandedStockId(isExpanded ? null : stock.id)}
                            className={cn("transition-colors group cursor-pointer", 
                              isExpanded ? (theme === 'dark' ? "bg-[#2c2e33]/40" : "bg-gray-100/50") : (theme === 'dark' ? "hover:bg-[#2c2e33]/20" : "hover:bg-gray-50"))}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden shrink-0 border", 
                                  theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-200")}>
                                  {stock.domain ? (
                                    <img 
                                      src={`https://www.google.com/s2/favicons?domain=${stock.domain}&sz=128`} 
                                      alt={stock.symbol}
                                      className="w-6 h-6 object-contain"
                                      referrerPolicy="no-referrer"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="font-bold text-[#F27D26]">${stock.symbol[0]}</span>`;
                                      }}
                                    />
                                  ) : (
                                    <span className="font-bold text-[#F27D26]">{stock.symbol[0]}</span>
                                  )}
                                </div>
                                <div>
                                  <p className={cn("font-bold text-base", theme === 'dark' ? "text-white" : "text-gray-900")}>{stock.name || 'Thai Stock'}</p>
                                  <p className="text-sm font-bold text-[#F27D26]">{stock.symbol}</p>
                                </div>
                              </div>
                            </td>
                            <td className={cn("px-6 py-4 text-right font-mono text-sm", theme === 'dark' ? "text-white" : "text-gray-600")}>
                              {stock.totalShares.toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={cn("font-mono font-bold text-sm", theme === 'dark' ? "text-white" : "text-gray-900")}>฿{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                              <p className={cn("font-mono text-[10px]", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>฿{stock.avgCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={cn("font-mono font-bold text-sm", theme === 'dark' ? "text-white" : "text-gray-900")}>฿{currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                              <p className={cn("font-mono text-[10px]", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>฿{stock.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={cn("font-mono font-bold text-sm", theme === 'dark' ? "text-white" : "text-gray-900")}>฿{totalDividends.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                              <p className={cn("font-mono text-[10px]", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Total Received</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={cn("font-mono font-bold text-sm", profit >= 0 ? "text-green-500" : "text-red-500")}>
                                {profit >= 0 ? '+' : ''}฿{profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                              <p className={cn("font-mono text-[10px]", profit >= 0 ? "text-green-500" : "text-red-500")}>
                                {profit >= 0 ? '▲' : '▼'} {profitPct.toFixed(2)}%
                              </p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={cn("font-mono font-bold text-sm text-green-500")}>0.00%</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <p className={cn("font-mono font-bold text-sm", theme === 'dark' ? "text-white" : "text-gray-900")}>{shareInPortfolio.toFixed(2)}%</p>
                              <p className={cn("font-mono text-[10px]", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>0.00%</p>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); setSelectedStockId(stock.id); setNewTrade({...newTrade, type: 'BUY'}); }}
                                  className={cn("p-2 rounded-lg transition-colors", 
                                    theme === 'dark' ? "hover:bg-[#2c2e33] text-[#8e9299] hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-900")}
                                  title="Add Trade Log"
                                >
                                  <Plus className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEditClick(stock); }}
                                  className={cn("p-2 rounded-lg transition-colors", 
                                    theme === 'dark' ? "hover:bg-[#2c2e33] text-[#8e9299] hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-900")}
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleDeleteStock(stock.id, stock.symbol); }}
                                  className={cn("p-2 rounded-lg transition-colors", 
                                    theme === 'dark' ? "hover:bg-red-500/10 text-[#8e9299] hover:text-red-500" : "hover:bg-red-50 text-gray-500 hover:text-red-600")}
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        
                        <AnimatePresence>
                          {isExpanded && (
                            <tr>
                              <td colSpan={9} className="p-0 border-none">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className={cn("overflow-hidden", theme === 'dark' ? "bg-[#1a1b1e]" : "bg-gray-50/50")}
                                >
                                  <div className="px-12 py-6 border-t border-b border-[#2c2e33]/30">
                                    <div className="flex items-center justify-between mb-4">
                                      <h4 className={cn("text-sm font-bold uppercase tracking-wider", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
                                        Last 10 Transactions
                                      </h4>
                                    </div>
                                    <div className="space-y-2">
                                      {stockTrades.length > 0 ? (
                                        stockTrades.map((trade) => {
                                          const tradeProfit = trade.type === 'BUY' 
                                            ? (stock.currentPrice - trade.price) * trade.shares
                                            : (trade.price - stock.avgCost) * trade.shares;
                                          const tradeProfitPct = trade.type === 'BUY'
                                            ? ((stock.currentPrice - trade.price) / trade.price) * 100
                                            : ((trade.price - stock.avgCost) / stock.avgCost) * 100;

                                          return (
                                            <div key={trade.id} className={cn("grid grid-cols-5 items-center p-3 rounded-xl border text-sm",
                                              theme === 'dark' ? "bg-[#2c2e33]/20 border-[#2c2e33]/50" : "bg-white border-gray-100")}>
                                              <div className="flex items-center gap-3">
                                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", 
                                                  trade.type === 'BUY' ? "bg-green-500/10 text-green-500" : 
                                                  trade.type === 'SELL' ? "bg-red-500/10 text-red-500" : 
                                                  "bg-blue-500/10 text-blue-500")}>
                                                  {trade.type === 'BUY' ? <ArrowDownRight className="w-4 h-4" /> : 
                                                   trade.type === 'SELL' ? <ArrowUpRight className="w-4 h-4" /> : 
                                                   <TrendingUp className="w-4 h-4" />}
                                                </div>
                                                <div>
                                                  <p className="font-bold text-xs">{trade.type}</p>
                                                  <p className={cn("text-[10px]", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                                                    {format(trade.date.toDate(), 'dd MMM yyyy')}
                                                  </p>
                                                </div>
                                              </div>
                                              <div>
                                                <p className={cn("text-[10px] uppercase font-bold", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Shares</p>
                                                <p className="font-mono font-bold">{trade.type === 'DIVIDEND' ? '-' : trade.shares.toLocaleString()}</p>
                                              </div>
                                              <div>
                                                <p className={cn("text-[10px] uppercase font-bold", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>{trade.type === 'DIVIDEND' ? 'Amount' : 'Price'}</p>
                                                <p className="font-mono font-bold">฿{trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                                              </div>
                                              <div>
                                                <p className={cn("text-[10px] uppercase font-bold", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                                                  {trade.type === 'BUY' ? 'Unrealized P/L' : trade.type === 'SELL' ? 'Realized P/L' : 'Income'}
                                                </p>
                                                <div className={cn("font-mono font-bold", 
                                                  trade.type === 'DIVIDEND' ? "text-blue-500" : 
                                                  tradeProfit >= 0 ? "text-green-500" : "text-red-500")}>
                                                  ฿{trade.type === 'DIVIDEND' ? (trade.price * trade.shares).toLocaleString(undefined, { minimumFractionDigits: 2 }) : tradeProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                              </div>
                                              <div className="text-right">
                                                <div className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold",
                                                  trade.type === 'DIVIDEND' ? "bg-blue-500/10 text-blue-500" :
                                                  tradeProfit >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500")}>
                                                  {trade.type === 'DIVIDEND' ? 'DIV' : (tradeProfit >= 0 ? '+' : '') + tradeProfitPct.toFixed(2) + '%'}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })
                                      ) : (
                                        <p className="text-center py-4 text-[#5c5f66]">No transactions found</p>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              </td>
                            </tr>
                          )}
                        </AnimatePresence>
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'history' && (
          <div className="space-y-6">
            {stocks.map(stock => {
              const stockTrades = trades.filter(t => t.stockId === stock.id).sort((a, b) => b.date.toMillis() - a.date.toMillis());
              if (stockTrades.length === 0) return null;
              return (
                <Card theme={theme} key={stock.id} className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#F27D26]/10 rounded-xl flex items-center justify-center text-[#F27D26] font-bold">
                        {stock.symbol[0]}
                      </div>
                      <h3 className={cn("text-xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>{stock.symbol} Trade Log</h3>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {stockTrades.map(trade => (
                      <div key={trade.id} className={cn("flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border transition-colors group", 
                        theme === 'dark' ? "bg-[#2c2e33]/30 border-[#2c2e33]" : "bg-gray-50 border-gray-100")}>
                        <div className="flex items-center gap-4 mb-2 md:mb-0">
                          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", 
                            trade.type === 'BUY' ? "bg-green-500/10 text-green-500" : 
                            trade.type === 'SELL' ? "bg-red-500/10 text-red-500" : 
                            "bg-blue-500/10 text-blue-500")}>
                            {trade.type === 'BUY' ? <ArrowDownRight className="w-5 h-5" /> : 
                             trade.type === 'SELL' ? <ArrowUpRight className="w-5 h-5" /> : 
                             <TrendingUp className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className={cn("font-bold text-lg", theme === 'dark' ? "text-white" : "text-gray-900")}>
                              {trade.type} {trade.type === 'DIVIDEND' ? '' : `${trade.shares.toLocaleString()} shares`}
                            </p>
                            <p className={cn("text-sm", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>{format(trade.date.toDate(), 'MMM dd, yyyy HH:mm')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <p className={cn("text-xs uppercase tracking-wider font-bold", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>{trade.type === 'DIVIDEND' ? 'Amount' : 'Price'}</p>
                            <p className={cn("font-mono font-bold text-lg", theme === 'dark' ? "text-white" : "text-gray-900")}>฿{trade.price.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-xs uppercase tracking-wider font-bold", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Total</p>
                            <p className={cn("font-mono font-bold text-lg", theme === 'dark' ? "text-white" : "text-gray-900")}>฿{(trade.shares * trade.price).toLocaleString()}</p>
                          </div>
                        </div>
                        {trade.notes && (
                          <div className={cn("mt-3 md:mt-0 md:ml-8 flex items-start gap-2 p-3 rounded-xl border max-w-xs",
                            theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-100")}>
                            <StickyNote className="w-4 h-4 text-[#F27D26] shrink-0 mt-0.5" />
                            <p className={cn("text-xs italic", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>"{trade.notes}"</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-3 md:mt-0">
                          <button 
                            onClick={() => {
                              setEditingTrade(trade);
                              setEditTradeData({
                                type: trade.type,
                                shares: trade.shares.toString(),
                                price: trade.price.toString(),
                                date: format(trade.date.toDate(), 'yyyy-MM-dd'),
                                notes: trade.notes || ''
                              });
                            }}
                            className={cn("p-2 rounded-lg transition-colors", 
                              theme === 'dark' ? "hover:bg-[#2c2e33] text-[#8e9299] hover:text-white" : "hover:bg-gray-200 text-gray-500 hover:text-gray-900")}
                            title="Edit Trade"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => setShowConfirmDeleteTrade(trade)}
                            className={cn("p-2 rounded-lg transition-colors", 
                              theme === 'dark' ? "hover:bg-red-500/10 text-[#8e9299] hover:text-red-500" : "hover:bg-red-50 text-gray-500 hover:text-red-600")}
                            title="Delete Trade"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Modals */}
      <AnimatePresence>
        {showConfirmDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full max-w-sm rounded-3xl p-8 shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#151619] border border-[#2c2e33]" : "bg-white border border-gray-100")}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-gray-900")}>Delete {showConfirmDelete.symbol}?</h3>
                <p className={cn("text-sm mb-8 leading-relaxed", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
                  Are you sure you want to delete this stock and all its trade logs? This action cannot be undone.
                </p>
                <div className="flex w-full gap-3">
                  <button 
                    onClick={() => setShowConfirmDelete(null)}
                    className={cn("flex-1 py-3 rounded-xl font-bold transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] hover:bg-[#3a3d42] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDelete}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingStock && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full max-w-md rounded-3xl p-8 shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#151619] border border-[#2c2e33]" : "bg-white border border-gray-100")}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>Edit Stock</h3>
                <button 
                  onClick={() => setEditingStock(null)}
                  className={cn("p-2 rounded-lg transition-colors", 
                    theme === 'dark' ? "hover:bg-[#2c2e33] text-[#8e9299]" : "hover:bg-gray-100 text-gray-500")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateStock} className="space-y-4">
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Stock Symbol</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. PTT, CPALL"
                    value={editStockData.symbol}
                    onChange={e => setEditStockData({...editStockData, symbol: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Company Name (Optional)</label>
                  <input 
                    type="text" 
                    placeholder="e.g. PTT Public Company"
                    value={editStockData.name}
                    onChange={e => setEditStockData({...editStockData, name: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Avg Cost</label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={editStockData.avgCost}
                      onChange={e => setEditStockData({...editStockData, avgCost: e.target.value})}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                  </div>
                  <div>
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Total Shares</label>
                    <input 
                      required
                      type="number" 
                      value={editStockData.totalShares}
                      onChange={e => setEditStockData({...editStockData, totalShares: e.target.value})}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Current Price (Optional)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="Leave 0 to auto-fetch"
                    value={editStockData.currentPrice}
                    onChange={e => setEditStockData({...editStockData, currentPrice: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => setEditingStock(null)}
                    className={cn("flex-1 py-3 rounded-xl font-bold transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] hover:bg-[#3a3d42] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isFetchingPrice}
                    className="flex-1 py-3 bg-[#F27D26] hover:bg-[#d96a1b] rounded-xl font-bold transition-colors shadow-lg shadow-[#F27D26]/20 text-white flex items-center justify-center gap-2"
                  >
                    {isFetchingPrice && <Loader2 className="w-4 h-4 animate-spin" />}
                    Update Stock
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showConfirmDeleteTrade && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full max-w-sm rounded-3xl p-8 shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#151619] border border-[#2c2e33]" : "bg-white border border-gray-100")}
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mb-6">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-gray-900")}>Delete Trade?</h3>
                <p className={cn("text-sm mb-8 leading-relaxed", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
                  Are you sure you want to delete this trade? The stock's average cost and total shares will be recalculated.
                </p>
                <div className="flex w-full gap-3">
                  <button 
                    onClick={() => setShowConfirmDeleteTrade(null)}
                    className={cn("flex-1 py-3 rounded-xl font-bold transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] hover:bg-[#3a3d42] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={confirmDeleteTrade}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 rounded-xl font-bold transition-colors shadow-lg shadow-red-500/20 text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {editingTrade && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full max-w-md rounded-3xl p-8 shadow-2xl overflow-hidden",
                theme === 'dark' ? "bg-[#151619] border border-[#2c2e33]" : "bg-white border border-gray-100")}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className={cn("text-2xl font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>Edit Trade</h3>
                <button 
                  onClick={() => setEditingTrade(null)}
                  className={cn("p-2 rounded-lg transition-colors", 
                    theme === 'dark' ? "hover:bg-[#2c2e33] text-[#8e9299]" : "hover:bg-gray-100 text-gray-500")}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleUpdateTrade} className="space-y-4">
                <div className={cn("flex p-1 rounded-xl mb-4", theme === 'dark' ? "bg-[#2c2e33]" : "bg-gray-100")}>
                  <button 
                    type="button"
                    onClick={() => setEditTradeData({...editTradeData, type: 'BUY'})}
                    className={cn("flex-1 py-2 rounded-lg font-bold transition-all text-xs", 
                      editTradeData.type === 'BUY' ? "bg-green-500 text-white shadow-sm" : (theme === 'dark' ? "text-[#8e9299]" : "text-gray-500"))}
                  >
                    BUY
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditTradeData({...editTradeData, type: 'SELL'})}
                    className={cn("flex-1 py-2 rounded-lg font-bold transition-all text-xs", 
                      editTradeData.type === 'SELL' ? "bg-red-500 text-white shadow-sm" : (theme === 'dark' ? "text-[#8e9299]" : "text-gray-500"))}
                  >
                    SELL
                  </button>
                  <button 
                    type="button"
                    onClick={() => setEditTradeData({...editTradeData, type: 'DIVIDEND'})}
                    className={cn("flex-1 py-2 rounded-lg font-bold transition-all text-xs", 
                      editTradeData.type === 'DIVIDEND' ? "bg-blue-500 text-white shadow-sm" : (theme === 'dark' ? "text-[#8e9299]" : "text-gray-500"))}
                  >
                    DIVIDEND
                  </button>
                </div>
                <div className={editTradeData.type === 'DIVIDEND' ? "block" : "grid grid-cols-2 gap-4"}>
                  {editTradeData.type !== 'DIVIDEND' && (
                    <div>
                      <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Shares</label>
                      <input 
                        required
                        type="number" 
                        value={editTradeData.shares}
                        onChange={e => setEditTradeData({...editTradeData, shares: e.target.value})}
                        className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                          theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                      />
                    </div>
                  )}
                  <div className={editTradeData.type === 'DIVIDEND' ? "w-full" : ""}>
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                      {editTradeData.type === 'DIVIDEND' ? 'Dividend Amount (฿)' : 'Price'}
                    </label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={editTradeData.price}
                      onChange={e => setEditTradeData({...editTradeData, price: e.target.value})}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Date</label>
                  <input 
                    required
                    type="date" 
                    value={editTradeData.date}
                    onChange={e => setEditTradeData({...editTradeData, date: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Notes</label>
                  <textarea 
                    placeholder="Notes about this trade..."
                    value={editTradeData.notes}
                    onChange={e => setEditTradeData({...editTradeData, notes: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] h-24 resize-none transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => setEditingTrade(null)}
                    className={cn("flex-1 py-3 rounded-xl font-bold transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] hover:bg-[#3a3d42] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#F27D26] hover:bg-[#d96a1b] rounded-xl font-bold transition-colors shadow-lg shadow-[#F27D26]/20 text-white"
                  >
                    Update Trade
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isSearchModalOpen && searchResult && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={cn("rounded-3xl p-0 w-full max-w-2xl shadow-2xl border overflow-hidden",
                theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-100")}
            >
              <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: theme === 'dark' ? '#2c2e33' : '#f3f4f6' }}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F27D26] rounded-2xl flex items-center justify-center shrink-0">
                    <TrendingUp className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className={cn("text-2xl font-bold tracking-tight", theme === 'dark' ? "text-white" : "text-gray-900")}>
                      {searchResult.symbol}
                    </h3>
                    <p className={cn("text-sm", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
                      {searchResult.name || 'Stock Details'} • {searchResult.industry || 'N/A'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSearchModalOpen(false)}
                  className={cn("p-2 rounded-xl transition-colors", theme === 'dark' ? "hover:bg-[#2c2e33] text-[#8e9299]" : "hover:bg-gray-100 text-gray-400")}
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                {/* 2-Year Chart */}
                <div className="mb-8">
                  <h4 className={cn("text-xs font-bold uppercase mb-4 tracking-wider", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                    2-Year Performance
                  </h4>
                  <div className="h-48 w-full">
                    {searchResult.history2Y && searchResult.history2Y.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={searchResult.history2Y}>
                          <defs>
                            <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F27D26" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#F27D26" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#2c2e33' : '#f3f4f6'} />
                          <XAxis 
                            dataKey="date" 
                            hide 
                          />
                          <YAxis 
                            hide 
                            domain={['auto', 'auto']}
                          />
                          <RechartsTooltip 
                            contentStyle={{ 
                              backgroundColor: theme === 'dark' ? '#1a1b1e' : '#fff',
                              border: `1px solid ${theme === 'dark' ? '#2c2e33' : '#f3f4f6'}`,
                              borderRadius: '12px',
                              fontSize: '12px'
                            }}
                            itemStyle={{ color: '#F27D26' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="price" 
                            stroke="#F27D26" 
                            strokeWidth={3}
                            fillOpacity={1} 
                            fill="url(#colorPrice)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={cn("h-full flex items-center justify-center rounded-2xl border-2 border-dashed", 
                        theme === 'dark' ? "border-[#2c2e33] text-[#5c5f66]" : "border-gray-100 text-gray-400")}>
                        No historical data available
                      </div>
                    )}
                  </div>
                </div>

                {/* Financial Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                  {[
                    { label: 'Current Price', value: `฿${searchResult.currentPrice.toLocaleString()}`, icon: Wallet },
                    { label: 'P/E Ratio', value: searchResult.pe ? `${searchResult.pe.toFixed(2)}x` : 'N/A', icon: TrendingUp },
                    { label: 'P/BV Ratio', value: searchResult.pbv ? `${searchResult.pbv.toFixed(2)}x` : 'N/A', icon: Briefcase },
                    { label: 'Market Cap', value: searchResult.marketCap ? `฿${(searchResult.marketCap / 1e9).toFixed(2)}B` : 'N/A', icon: LayoutDashboard },
                    { label: 'Free Float', value: searchResult.freeFloat ? `${(searchResult.freeFloat / 1e6).toFixed(2)}M` : 'N/A', icon: History },
                    { label: 'Dividend Yield', value: searchResult.dividendYield ? `${(searchResult.dividendYield * 100).toFixed(2)}%` : 'N/A', icon: TrendingUp },
                  ].map((metric, i) => (
                    <div key={i} className={cn("p-4 rounded-2xl border transition-all", 
                      theme === 'dark' ? "bg-[#151619] border-[#2c2e33]" : "bg-gray-50 border-gray-100")}>
                      <p className={cn("text-[10px] font-bold uppercase mb-1 tracking-wider", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                        {metric.label}
                      </p>
                      <p className={cn("text-lg font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                  {searchResult.id !== 'temp' ? (
                    <button 
                      onClick={() => {
                        setIsSearchModalOpen(false);
                        setActiveTab('holdings');
                        setSelectedStockId(searchResult.id);
                      }}
                      className="flex-1 py-4 bg-[#F27D26] hover:bg-[#d96a1b] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#F27D26]/20"
                    >
                      <History className="w-5 h-5" />
                      Record Trade
                    </button>
                  ) : (
                    <button 
                      onClick={() => {
                        setIsSearchModalOpen(false);
                        setNewStock({
                          symbol: searchResult.symbol,
                          name: searchResult.name || '',
                          avgCost: '',
                          totalShares: '',
                          currentPrice: searchResult.currentPrice.toString(),
                          highPrice: 0
                        });
                        setShowAddStock(true);
                      }}
                      className="flex-1 py-4 bg-[#F27D26] hover:bg-[#d96a1b] text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-[#F27D26]/20"
                    >
                      <Plus className="w-5 h-5" />
                      Add to Portfolio
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showAddStock && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn("rounded-3xl p-8 w-full max-w-md shadow-2xl border", 
                theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-100")}
            >
              <h3 className={cn("text-2xl font-bold mb-6", theme === 'dark' ? "text-white" : "text-gray-900")}>Add New Stock</h3>
              <form onSubmit={handleAddStock} className="space-y-4">
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Symbol</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. PTT"
                      value={newStock.symbol}
                      onChange={e => setNewStock({...newStock, symbol: e.target.value})}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleFetchStockData();
                        }
                      }}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleFetchStockData}
                    disabled={isFetchingPrice || !newStock.symbol}
                    className={cn("p-3 rounded-xl border transition-all flex items-center justify-center h-[50px] w-[50px]",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-[#8e9299] hover:text-white" : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100")}
                  >
                    {isFetchingPrice ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  </button>
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Purchase Date</label>
                  <input 
                    required
                    type="date" 
                    value={newStock.date}
                    onChange={e => setNewStock({...newStock, date: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Shares</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0"
                    value={newStock.totalShares}
                    onChange={e => setNewStock({...newStock, totalShares: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Avg Cost</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="0.00"
                      value={newStock.avgCost}
                      onChange={e => setNewStock({...newStock, avgCost: e.target.value})}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                    {newStock.highPrice > 0 && (
                      <p className="text-[10px] mt-1 text-[#8e9299]">Day High: ฿{newStock.highPrice}</p>
                    )}
                  </div>
                  <div>
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Current Price</label>
                    <input 
                      type="number" 
                      step="0.01"
                      placeholder="Auto-fetch"
                      value={newStock.currentPrice}
                      onChange={e => setNewStock({...newStock, currentPrice: e.target.value})}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                  </div>
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => setShowAddStock(false)}
                    className={cn("flex-1 py-3 rounded-xl font-bold transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] hover:bg-[#3a3d42] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isFetchingPrice}
                    className={cn("flex-1 py-3 bg-[#F27D26] hover:bg-[#d96a1b] rounded-xl font-bold transition-colors shadow-lg shadow-[#F27D26]/20 text-white flex items-center justify-center gap-2",
                      isFetchingPrice && "opacity-50 cursor-not-allowed")}
                  >
                    {isFetchingPrice ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : 'Save Stock'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {selectedStockId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn("rounded-3xl p-8 w-full max-w-md shadow-2xl border",
                theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-100")}
            >
              <h3 className={cn("text-2xl font-bold mb-6 flex items-center justify-between", theme === 'dark' ? "text-white" : "text-gray-900")}>
                Add Trade Log
                {isFetchingPrice && <RefreshCw className="w-5 h-5 animate-spin text-[#F27D26]" />}
              </h3>
              <p className={cn("text-sm mb-6", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
                Recording trade for <span className={cn("font-bold", theme === 'dark' ? "text-white" : "text-gray-900")}>{stocks.find(s => s.id === selectedStockId)?.symbol}</span>
              </p>
              <form onSubmit={handleAddTrade} className="space-y-4">
                <div className={cn("flex p-1 rounded-xl mb-4", theme === 'dark' ? "bg-[#2c2e33]" : "bg-gray-100")}>
                  <button 
                    type="button"
                    onClick={() => setNewTrade({...newTrade, type: 'BUY'})}
                    className={cn("flex-1 py-2 rounded-lg font-bold transition-all text-xs", 
                      newTrade.type === 'BUY' ? "bg-green-500 text-white shadow-sm" : (theme === 'dark' ? "text-[#8e9299]" : "text-gray-500"))}
                  >
                    BUY
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewTrade({...newTrade, type: 'SELL'})}
                    className={cn("flex-1 py-2 rounded-lg font-bold transition-all text-xs", 
                      newTrade.type === 'SELL' ? "bg-red-500 text-white shadow-sm" : (theme === 'dark' ? "text-[#8e9299]" : "text-gray-500"))}
                  >
                    SELL
                  </button>
                  <button 
                    type="button"
                    onClick={() => setNewTrade({...newTrade, type: 'DIVIDEND'})}
                    className={cn("flex-1 py-2 rounded-lg font-bold transition-all text-xs", 
                      newTrade.type === 'DIVIDEND' ? "bg-blue-500 text-white shadow-sm" : (theme === 'dark' ? "text-[#8e9299]" : "text-gray-500"))}
                  >
                    DIVIDEND
                  </button>
                </div>
                <div className={newTrade.type === 'DIVIDEND' ? "block" : "grid grid-cols-2 gap-4"}>
                  {newTrade.type !== 'DIVIDEND' && (
                    <div>
                      <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Shares</label>
                      <input 
                        required
                        type="number" 
                        value={newTrade.shares}
                        onChange={e => setNewTrade({...newTrade, shares: e.target.value})}
                        className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                          theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                      />
                    </div>
                  )}
                  <div className={newTrade.type === 'DIVIDEND' ? "w-full" : ""}>
                    <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>
                      {newTrade.type === 'DIVIDEND' ? 'Dividend Amount (฿)' : 'Price'}
                    </label>
                    <input 
                      required
                      type="number" 
                      step="0.01"
                      value={newTrade.price}
                      onChange={e => setNewTrade({...newTrade, price: e.target.value})}
                      className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                        theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                    />
                  </div>
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Date</label>
                  <input 
                    required
                    type="date" 
                    value={newTrade.date}
                    onChange={e => setNewTrade({...newTrade, date: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div>
                  <label className={cn("block text-xs font-bold uppercase mb-2", theme === 'dark' ? "text-[#5c5f66]" : "text-gray-400")}>Notes</label>
                  <textarea 
                    placeholder="Why did you make this trade?"
                    value={newTrade.notes}
                    onChange={e => setNewTrade({...newTrade, notes: e.target.value})}
                    className={cn("w-full border rounded-xl px-4 py-3 focus:outline-none focus:border-[#F27D26] h-24 resize-none transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] border-[#3a3d42] text-white" : "bg-gray-50 border-gray-200 text-gray-900")}
                  />
                </div>
                <div className="flex gap-3 mt-8">
                  <button 
                    type="button"
                    onClick={() => setSelectedStockId(null)}
                    className={cn("flex-1 py-3 rounded-xl font-bold transition-colors",
                      theme === 'dark' ? "bg-[#2c2e33] hover:bg-[#3a3d42] text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700")}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 bg-[#F27D26] hover:bg-[#d96a1b] rounded-xl font-bold transition-colors shadow-lg shadow-[#F27D26]/20 text-white"
                  >
                    Save Trade
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showNotFound && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={cn("rounded-3xl p-8 w-full max-w-sm shadow-2xl border text-center",
                theme === 'dark' ? "bg-[#1a1b1e] border-[#2c2e33]" : "bg-white border-gray-100")}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className={cn("text-xl font-bold mb-2", theme === 'dark' ? "text-white" : "text-gray-900")}>Stock Not Found</h3>
              <p className={cn("text-sm mb-8", theme === 'dark' ? "text-[#8e9299]" : "text-gray-500")}>
                We couldn't find any stock matching "{searchQuery}". Please check the symbol and try again.
              </p>
              <button 
                onClick={() => setShowNotFound(false)}
                className="w-full py-3 bg-[#F27D26] hover:bg-[#d96a1b] text-white rounded-xl font-bold transition-all"
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
