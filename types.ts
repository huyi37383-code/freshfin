export enum TransactionType {
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME'
}

export interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: TransactionType;
  date: string; // ISO string YYYY-MM-DD
  timestamp: number;
}

export interface BudgetConfig {
  monthlyLimit: number;
}

export interface DailyStats {
  daysRemaining: number;
  dailyAvailable: number;
  totalSpentThisMonth: number;
  totalIncomeThisMonth: number;
  remainingBudget: number;
}

export interface ChartDataPoint {
  date: string; // Day of month
  income: number;
  expense: number;
}

export interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
}