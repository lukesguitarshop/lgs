export interface ExtraExpense {
  id: string;
  date: string;
  category: string;
  cost: number;
  createdAt: string;
}

export interface CreateExtraExpenseRequest {
  date: string;
  category: string;
  cost: number;
}
