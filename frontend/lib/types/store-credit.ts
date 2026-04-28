export interface StoreCreditEntry {
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  createdAt: string;
}

export interface StoreCreditDto {
  balance: number;
  history: StoreCreditEntry[];
}
