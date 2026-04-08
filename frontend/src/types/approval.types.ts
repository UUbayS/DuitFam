export interface WithdrawalRequestItem {
  id: string;
  child_id: string;
  parent_id: string;
  amount: number;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}
