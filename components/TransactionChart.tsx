import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChartDataPoint } from '../types';

interface TransactionChartProps {
  data: ChartDataPoint[];
}

const TransactionChart: React.FC<TransactionChartProps> = ({ data }) => {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-white/50 rounded-xl border border-slate-100 text-slate-400">
        暂无本月数据
      </div>
    );
  }

  return (
    <div className="h-72 w-full bg-white rounded-xl p-4 shadow-sm border border-slate-100">
      <h3 className="text-sm font-semibold text-slate-600 mb-4">收支趋势</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: -20,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 12 }} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#94a3b8', fontSize: 12 }} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            labelStyle={{ color: '#64748b' }}
          />
          <Area
            type="monotone"
            dataKey="income"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorIncome)"
            name="收入"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="expense"
            stroke="#f43f5e"
            fillOpacity={1}
            fill="url(#colorExpense)"
            name="支出"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TransactionChart;