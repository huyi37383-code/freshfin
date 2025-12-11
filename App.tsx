import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Plus, 
  Minus, 
  Wallet, 
  TrendingUp, 
  Calendar, 
  Settings, 
  Trash2, 
  Sparkles,
  PieChart,
  ArrowDown,
  ArrowUp,
  Tags,
  Edit,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Transaction, TransactionType, DailyStats, ChartDataPoint, CategoryData } from './types';
import TransactionChart from './components/TransactionChart';
import { getFinancialAdvice } from './services/geminiService';

// Constants
const STORAGE_KEY_TRANSACTIONS = 'freshfin_transactions';
const STORAGE_KEY_BUDGET = 'freshfin_budget';

function App() {
  // --- State ---
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_TRANSACTIONS);
    return saved ? JSON.parse(saved) : [];
  });

  const [monthlyBudget, setMonthlyBudget] = useState<number>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BUDGET);
    return saved ? parseFloat(saved) : 5000;
  });

  // View Date State - Defaults to today, allows navigation
  const [viewDate, setViewDate] = useState(new Date());

  const [newTransTitle, setNewTransTitle] = useState('');
  const [newTransAmount, setNewTransAmount] = useState('');
  const [newTransType, setNewTransType] = useState<TransactionType>(TransactionType.EXPENSE);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [tempBudgetInput, setTempBudgetInput] = useState(monthlyBudget.toString());
  
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- Effects ---
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_BUDGET, monthlyBudget.toString());
  }, [monthlyBudget]);

  // --- Helpers ---
  const isCurrentMonth = useMemo(() => {
    const today = new Date();
    return viewDate.getMonth() === today.getMonth() && 
           viewDate.getFullYear() === today.getFullYear();
  }, [viewDate]);

  const changeMonth = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
    setAiAdvice(null); // Reset AI advice when changing context
  };

  // --- Calculations ---
  const currentMonthStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonthStr));
  }, [transactions, currentMonthStr]);

  const stats = useMemo((): DailyStats => {
    const totalSpent = currentMonthTransactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalIncome = currentMonthTransactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((sum, t) => sum + t.amount, 0);

    const remainingBudget = monthlyBudget - totalSpent;
    
    // Calculate days logic
    const today = new Date();
    const lastDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    
    let daysRemaining = 0;
    let dailyAvailable = 0;

    if (isCurrentMonth) {
      const currentDay = today.getDate();
      daysRemaining = Math.max(1, lastDayOfMonth - currentDay + 1);
      dailyAvailable = Math.max(0, remainingBudget / daysRemaining);
    } else {
      // For past/future months, daily available logic is different
      // If past: functionality changes to "Budget Result"
      daysRemaining = 0; 
      dailyAvailable = 0;
    }

    return {
      daysRemaining,
      dailyAvailable,
      totalSpentThisMonth: totalSpent,
      totalIncomeThisMonth: totalIncome,
      remainingBudget
    };
  }, [currentMonthTransactions, monthlyBudget, viewDate, isCurrentMonth]);

  const chartData = useMemo((): ChartDataPoint[] => {
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    const data: ChartDataPoint[] = [];
    const today = new Date();

    // Initialize map
    const dayMap = new Map<number, { income: number; expense: number }>();
    for (let i = 1; i <= daysInMonth; i++) {
        dayMap.set(i, { income: 0, expense: 0 });
    }

    // Fill data
    currentMonthTransactions.forEach(t => {
      const day = parseInt(t.date.split('-')[2]);
      const current = dayMap.get(day) || { income: 0, expense: 0 };
      if (t.type === TransactionType.INCOME) {
        current.income += t.amount;
      } else {
        current.expense += t.amount;
      }
      dayMap.set(day, current);
    });

    // Determine how many days to show
    let showUntilDay = daysInMonth; // Default to full month (for past months)
    
    if (isCurrentMonth) {
      showUntilDay = today.getDate();
    } else if (viewDate > today) {
      showUntilDay = 0; // Don't show chart for future
    }

    // Convert to array
    for (let i = 1; i <= daysInMonth; i++) {
      if (i <= showUntilDay) { 
         const entry = dayMap.get(i);
         data.push({
           date: `${i}日`,
           income: entry?.income || 0,
           expense: entry?.expense || 0
         });
      }
    }
    return data;
  }, [currentMonthTransactions, viewDate, isCurrentMonth]);

  const categoryStats = useMemo((): CategoryData[] => {
    const expenses = currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE);
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalExpense === 0) return [];

    const groupMap: Record<string, number> = {};
    expenses.forEach(t => {
      groupMap[t.title] = (groupMap[t.title] || 0) + t.amount;
    });

    return Object.entries(groupMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: (amount / totalExpense) * 100
      }))
      .sort((a, b) => b.amount - a.amount); 
  }, [currentMonthTransactions]);


  // --- Handlers ---
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransTitle || !newTransAmount) return;

    const amount = parseFloat(newTransAmount);
    if (isNaN(amount) || amount <= 0) return;

    // IMPORTANT: When adding, default to TODAY, but if user is viewing a past month, 
    // we should probably warn them or switch back? 
    // For simplicity: Simple expense trackers usually add to "Today" regardless of view, 
    // OR add to the "Viewed Month". 
    // Let's add to TODAY to prevent accidents, but if viewDate is different, maybe switch viewDate to today?
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Check if user is trying to add to a past month context visually
    // To keep it simple and safe: We always add transactions as TODAY's date.
    // If the user is viewing last month, they won't see it immediately unless we switch view.
    
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      title: newTransTitle,
      amount,
      type: newTransType,
      date: todayStr, // Always log as today
      timestamp: Date.now()
    };

    setTransactions(prev => [newTransaction, ...prev]);
    setNewTransTitle('');
    setNewTransAmount('');
    
    // If not viewing current month, switch back so they see what they added
    if (!isCurrentMonth) {
      setViewDate(new Date());
    }
  };

  const handleDelete = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
  };

  const saveBudget = () => {
    const val = parseFloat(tempBudgetInput);
    if (!isNaN(val) && val > 0) {
      setMonthlyBudget(val);
      setIsBudgetModalOpen(false);
    }
  };

  const handleGetAdvice = async () => {
    setIsAiLoading(true);
    setAiAdvice(null);
    const advice = await getFinancialAdvice(transactions, monthlyBudget);
    setAiAdvice(advice);
    setIsAiLoading(false);
  };

  // --- Render Helpers ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(amount);
  };

  const formatMonth = (date: Date) => {
    return `${date.getFullYear()}年${date.getMonth() + 1}月`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      
      {/* Header */}
      <header className="bg-white sticky top-0 z-20 border-b border-slate-100 shadow-sm px-4 py-3 md:px-6">
        <div className="flex justify-between items-center mb-3 md:mb-0">
          <div className="flex items-center gap-2 text-teal-600">
            <Wallet className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight text-slate-800">FreshFin</h1>
          </div>
          <button 
            onClick={() => {
              setTempBudgetInput(monthlyBudget.toString());
              setIsBudgetModalOpen(true);
            }}
            className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors text-slate-600"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Month Navigator */}
        <div className="flex items-center justify-center gap-4 py-1">
          <button onClick={() => changeMonth(-1)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h2 className="text-lg font-semibold text-slate-700 min-w-[8rem] text-center select-none">
            {formatMonth(viewDate)}
          </h2>
          <button 
            onClick={() => changeMonth(1)} 
            disabled={isCurrentMonth && viewDate.getDate() >= new Date().getDate()} // Optional: disable future navigation if desired, but let's allow it to see 0
            className={`p-1 rounded-full ${isCurrentMonth ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
          >
             {/* If it's current month, we generally don't navigate to future for logging, but we can allow it. 
                 Let's disable the Right arrow if it is current month to imply "This is the latest". */}
             {!isCurrentMonth && <ChevronRight className="w-6 h-6" />}
             {isCurrentMonth && <div className="w-6 h-6" />} {/* Spacer */}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* 1. Dashboard Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Hero Card - Dynamic based on whether it is current or past month */}
          <div className={`md:col-span-3 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden bg-gradient-to-br ${isCurrentMonth ? 'from-teal-500 to-emerald-600' : 'from-slate-500 to-slate-600'}`}>
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calendar className="w-32 h-32" />
             </div>
             <div className="relative z-10">
                {isCurrentMonth ? (
                  <>
                    <p className="text-emerald-100 text-sm font-medium mb-1">今日可用余额 (日均)</p>
                    <div className="text-5xl font-bold tracking-tight mb-4">
                      {formatCurrency(stats.dailyAvailable)}
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="opacity-70 block text-xs">本月预算剩余</span>
                        <span className="font-semibold">{formatCurrency(stats.remainingBudget)}</span>
                      </div>
                      <div>
                        <span className="opacity-70 block text-xs">距离月底</span>
                        <span className="font-semibold">{stats.daysRemaining} 天</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-slate-200 text-sm font-medium mb-1">本月最终结余</p>
                    <div className="text-5xl font-bold tracking-tight mb-4">
                      {formatCurrency(stats.remainingBudget)}
                    </div>
                    <div className="flex gap-6 text-sm">
                      <div>
                        <span className="opacity-70 block text-xs">月度总预算</span>
                        <span className="font-semibold">{formatCurrency(monthlyBudget)}</span>
                      </div>
                      <div className="bg-white/20 px-2 py-0.5 rounded text-xs flex items-center">
                        历史账单
                      </div>
                    </div>
                  </>
                )}
             </div>
          </div>

          {/* Income & Expense Summaries */}
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">本月支出</p>
              <p className="text-2xl font-bold text-rose-500 mt-1">{formatCurrency(stats.totalSpentThisMonth)}</p>
            </div>
            <div className="h-10 w-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500">
              <ArrowDown className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">本月收入</p>
              <p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(stats.totalIncomeThisMonth)}</p>
            </div>
            <div className="h-10 w-10 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
              <ArrowUp className="w-5 h-5" />
            </div>
          </div>

          {/* Budget Card */}
          <div 
            onClick={() => {
              setTempBudgetInput(monthlyBudget.toString());
              setIsBudgetModalOpen(true);
            }}
            className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between cursor-pointer hover:shadow-md transition-all group"
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-xs text-slate-500 font-medium uppercase">月度预算设置</p>
                <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-2xl font-bold text-slate-700">{formatCurrency(monthlyBudget)}</p>
            </div>
             <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* 2. Add Transaction Form - Only show if viewing current month to avoid date confusion */}
        {isCurrentMonth && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
             <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
               <Plus className="w-4 h-4" /> 记一笔 (今日)
             </h3>
             <form onSubmit={handleAddTransaction} className="flex flex-col md:flex-row gap-3">
               <div className="flex bg-slate-50 rounded-lg p-1 border border-slate-200 w-full md:w-auto shrink-0">
                 <button
                   type="button"
                   onClick={() => setNewTransType(TransactionType.EXPENSE)}
                   className={`flex-1 md:w-24 py-2 text-sm font-medium rounded-md transition-all ${
                     newTransType === TransactionType.EXPENSE 
                     ? 'bg-white text-rose-500 shadow-sm' 
                     : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   支出
                 </button>
                 <button
                   type="button"
                   onClick={() => setNewTransType(TransactionType.INCOME)}
                   className={`flex-1 md:w-24 py-2 text-sm font-medium rounded-md transition-all ${
                     newTransType === TransactionType.INCOME 
                     ? 'bg-white text-teal-600 shadow-sm' 
                     : 'text-slate-500 hover:text-slate-700'
                   }`}
                 >
                   收入
                 </button>
               </div>
               
               <input
                 type="text"
                 placeholder="项目名称"
                 value={newTransTitle}
                 onChange={(e) => setNewTransTitle(e.target.value)}
                 className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm"
                 required
               />
               
               <input
                 type="number"
                 placeholder="金额"
                 value={newTransAmount}
                 onChange={(e) => setNewTransAmount(e.target.value)}
                 step="0.01"
                 min="0"
                 className="w-full md:w-32 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-sm font-mono"
                 required
               />

               <button 
                 type="submit"
                 className="w-full md:w-auto px-6 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
               >
                 <Plus className="w-4 h-4" /> 确认
               </button>
             </form>
          </section>
        )}

        {/* 3. AI Insights - Only relevant for current context data */}
        {currentMonthTransactions.length > 0 && (
          <section className="bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-violet-100 p-5">
            <div className="flex items-start justify-between">
               <div className="flex items-center gap-2 text-violet-700 font-semibold mb-2">
                 <Sparkles className="w-4 h-4" /> AI 财务顾问 ({formatMonth(viewDate)})
               </div>
               {!aiAdvice && (
                  <button 
                    onClick={handleGetAdvice}
                    disabled={isAiLoading}
                    className="text-xs bg-white border border-violet-200 text-violet-600 px-3 py-1.5 rounded-full hover:bg-violet-50 transition-colors disabled:opacity-50"
                  >
                    {isAiLoading ? '分析中...' : '分析本月支出'}
                  </button>
               )}
            </div>
            
            {aiAdvice ? (
              <div className="mt-2 text-sm text-slate-700 leading-relaxed bg-white/60 p-3 rounded-lg border border-violet-100 animate-in fade-in duration-500">
                 {aiAdvice}
                 <div className="mt-2 text-right">
                    <button onClick={() => setAiAdvice(null)} className="text-xs text-violet-400 hover:text-violet-600 underline">收起</button>
                 </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-1">点击按钮，让 AI 分析您{formatMonth(viewDate)}的消费习惯。</p>
            )}
          </section>
        )}

        {/* 4. Spending Breakdown */}
        {categoryStats.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
             <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
               <Tags className="w-4 h-4" /> 支出分类
             </h3>
             <div className="space-y-4">
                {categoryStats.map((cat, index) => (
                  <div key={index}>
                    <div className="flex justify-between items-end mb-1">
                      <div className="flex items-center gap-2">
                         <span className="text-sm font-medium text-slate-700">{cat.name}</span>
                         <span className="text-xs text-slate-400 font-mono">{cat.percentage.toFixed(1)}%</span>
                      </div>
                      <span className="text-sm font-mono font-semibold text-slate-700">
                        {formatCurrency(cat.amount)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-rose-400 h-2 rounded-full" 
                        style={{ width: `${cat.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
             </div>
          </section>
        )}

        {/* 5. Charts */}
        <section>
          <TransactionChart data={chartData} />
        </section>

        {/* 6. Transaction List */}
        <section>
          <h3 className="text-sm font-semibold text-slate-600 mb-4 ml-1">{formatMonth(viewDate)}明细</h3>
          <div className="space-y-3">
            {currentMonthTransactions.length === 0 ? (
               <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                 本月暂无收支记录
               </div>
            ) : (
              currentMonthTransactions.sort((a, b) => b.timestamp - a.timestamp).map(t => (
                <div key={t.id} className="group bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-500' : 'bg-teal-50 text-teal-600'
                     }`}>
                        {t.type === TransactionType.EXPENSE ? <Minus className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                     </div>
                     <div>
                       <p className="font-medium text-slate-800">{t.title}</p>
                       <p className="text-xs text-slate-400">{t.date}</p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`font-mono font-semibold ${
                      t.type === TransactionType.EXPENSE ? 'text-rose-500' : 'text-teal-600'
                    }`}>
                      {t.type === TransactionType.EXPENSE ? '-' : '+'}{formatCurrency(t.amount)}
                    </span>
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-2">设置月度预算</h3>
              <p className="text-sm text-slate-500 mb-6">设置通用的月度预算标准。</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">本月限额 (CNY)</label>
                  <input 
                    type="number"
                    value={tempBudgetInput}
                    onChange={(e) => setTempBudgetInput(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-lg font-mono focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex gap-3 justify-end border-t border-slate-100">
              <button 
                onClick={() => setIsBudgetModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={saveBudget}
                className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                保存设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;