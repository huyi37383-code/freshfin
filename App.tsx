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
  Tags
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

  // --- Calculations ---
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

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
    
    // Calculate days remaining
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const currentDay = today.getDate();
    const daysRemaining = Math.max(1, lastDayOfMonth - currentDay + 1); // Including today

    const dailyAvailable = Math.max(0, remainingBudget / daysRemaining);

    return {
      daysRemaining,
      dailyAvailable,
      totalSpentThisMonth: totalSpent,
      totalIncomeThisMonth: totalIncome,
      remainingBudget
    };
  }, [currentMonthTransactions, monthlyBudget, today]);

  const chartData = useMemo((): ChartDataPoint[] => {
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const data: ChartDataPoint[] = [];

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

    // Convert to array
    for (let i = 1; i <= daysInMonth; i++) {
      if (i <= today.getDate()) { // Only show up to today or show whole month? Let's show whole month but zero future
         const entry = dayMap.get(i);
         data.push({
           date: `${i}日`,
           income: entry?.income || 0,
           expense: entry?.expense || 0
         });
      }
    }
    return data;
  }, [currentMonthTransactions, today]);

  const categoryStats = useMemo((): CategoryData[] => {
    const expenses = currentMonthTransactions.filter(t => t.type === TransactionType.EXPENSE);
    const totalExpense = expenses.reduce((sum, t) => sum + t.amount, 0);
    
    if (totalExpense === 0) return [];

    const groupMap: Record<string, number> = {};
    expenses.forEach(t => {
      // Use the transaction title as the category name
      groupMap[t.title] = (groupMap[t.title] || 0) + t.amount;
    });

    return Object.entries(groupMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: (amount / totalExpense) * 100
      }))
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending
  }, [currentMonthTransactions]);


  // --- Handlers ---
  const handleAddTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransTitle || !newTransAmount) return;

    const amount = parseFloat(newTransAmount);
    if (isNaN(amount) || amount <= 0) return;

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      title: newTransTitle,
      amount,
      type: newTransType,
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
      timestamp: Date.now()
    };

    setTransactions(prev => [newTransaction, ...prev]);
    setNewTransTitle('');
    setNewTransAmount('');
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20">
      
      {/* Header */}
      <header className="bg-white sticky top-0 z-20 border-b border-slate-100 shadow-sm px-4 py-4 md:px-6 flex justify-between items-center">
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
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">

        {/* 1. Dashboard Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Daily Available - The Hero Card */}
          <div className="md:col-span-3 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calendar className="w-32 h-32" />
             </div>
             <div className="relative z-10">
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

          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase">月度预算</p>
              <p className="text-2xl font-bold text-slate-700 mt-1">{formatCurrency(monthlyBudget)}</p>
            </div>
             <div className="h-10 w-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-500">
              <PieChart className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* 2. Add Transaction Form */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
           <h3 className="text-sm font-semibold text-slate-600 mb-4 flex items-center gap-2">
             <Plus className="w-4 h-4" /> 记一笔
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
               placeholder="项目名称 (如: 早餐)"
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

        {/* 3. AI Insights */}
        <section className="bg-gradient-to-r from-violet-50 to-fuchsia-50 rounded-xl border border-violet-100 p-5">
          <div className="flex items-start justify-between">
             <div className="flex items-center gap-2 text-violet-700 font-semibold mb-2">
               <Sparkles className="w-4 h-4" /> AI 财务顾问
             </div>
             {!aiAdvice && (
                <button 
                  onClick={handleGetAdvice}
                  disabled={isAiLoading}
                  className="text-xs bg-white border border-violet-200 text-violet-600 px-3 py-1.5 rounded-full hover:bg-violet-50 transition-colors disabled:opacity-50"
                >
                  {isAiLoading ? '分析中...' : '分析我的支出'}
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
            <p className="text-xs text-slate-500 mt-1">点击按钮，让 AI 根据您本月的消费习惯提供个性化建议。</p>
          )}
        </section>

        {/* 4. Spending Breakdown (New Feature) */}
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
          <h3 className="text-sm font-semibold text-slate-600 mb-4 ml-1">近期明细</h3>
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
              <p className="text-sm text-slate-500 mb-6">合理的预算是理财的第一步。建议根据实际收入设置。</p>
              
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