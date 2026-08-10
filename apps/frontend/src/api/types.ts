export type Account = {
  id: number;
  accountName: string;
  accountType: string;
  currentBalance: number;
  isActive: boolean;
};

export type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export type Transaction = {
  id: number;
  accountId: number | null;
  accountName: string | null;
  accountType: string | null;
  destinationAccountId: number | null;
  destinationAccountName: string | null;
  budgetPeriodId: number | null;
  periodStartDate?: string | null;
  periodEndDate?: string | null;
  transactionType: TransactionType;
  amount: number;
  transactionDate: string;
  category: string | null;
  note: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type BudgetPeriod = {
  id: number;
  startDate: string;
  endDate: string;
  savingPercentage: number;
  status: string;
};

export type Dashboard = {
  top: { currentBalance: number };
  mid: {
    totalIncome: number;
    totalExpense: number;
    spendingBudget: number;
    remainingBudget: number;
    remainingDays: number;
    availablePerDay: number;
  };
  bottom: {
    id: number;
    category: string | null;
    note: string | null;
    amount: number;
    transactionType: TransactionType;
    transactionDate: string;
    accountName: string;
    destinationAccountId?: number | null;
    destinationAccountName?: string | null;
    createdAt: string;
  }[];
};

export type AccountsResponse = { data: Account[] };
export type DashboardResponse = { data: Dashboard };
export type ActivePeriodResponse = { data: BudgetPeriod | null };
export type TransactionsResponse = {
  data: Transaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
