export interface SpendingTip {
  id: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface SpendingTipsResponse {
  tips: {
    budget_tips: SpendingTip[];
    category_tips: SpendingTip[];
    saving_tips: SpendingTip[];
    warnings: SpendingTip[];
  };
  financial_snapshot: {
    income: number;
    expense: number;
    balance: number;
  };
  cached: boolean;
  generated_at: string;
  error?: string;
}
