import { GoogleGenAI } from "@google/genai";
import { Transaction, TransactionType } from "../types";

const apiKey = process.env.API_KEY || '';

// Initialize safely, though we expect the key to be there in the environment
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const getFinancialAdvice = async (
  transactions: Transaction[],
  budget: number
): Promise<string> => {
  if (!ai) {
    return "API Key is missing. Please check your configuration.";
  }

  // Filter for current month to be relevant
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const recentTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalSpent = recentTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = recentTransactions
    .filter(t => t.type === TransactionType.INCOME)
    .reduce((sum, t) => sum + t.amount, 0);

  // Summarize top spending categories (by title grouping for simplicity)
  const spendingMap: Record<string, number> = {};
  recentTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .forEach(t => {
        spendingMap[t.title] = (spendingMap[t.title] || 0) + t.amount;
    });
  
  const topSpending = Object.entries(spendingMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, amount]) => `${name}: ¥${amount}`)
    .join(', ');

  const prompt = `
    You are a helpful, encouraging financial assistant for a daily expense tracker app.
    
    Current Month Context:
    - Monthly Budget: ¥${budget}
    - Total Spent: ¥${totalSpent}
    - Total Income: ¥${totalIncome}
    - Top Expenses: ${topSpending || 'None'}
    - Remaining Budget: ¥${budget - totalSpent}
    
    Please provide a brief, friendly, and actionable financial insight or advice (max 3 sentences). 
    If they are over budget, be gentle but firm. If they are saving well, congratulate them.
    Use emojis to make it lively.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No insight available at the moment.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Could not generate advice at this time. Please try again later.";
  }
};