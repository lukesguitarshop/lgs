export interface Transaction {
  id: string;
  date: string;
  guitarName: string;
  purchasePrice: number | null;
  transactionType: 'sold' | 'traded' | 'for_sale';
  soldVia: string | null;
  tradeFor: string | null;
  revenue: number | null;
  shippingCost: number | null;
  profit: number | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTransactionRequest {
  date: string;
  guitarName: string;
  purchasePrice: number | null;
  transactionType: 'sold' | 'traded' | 'for_sale';
  soldVia: string | null;
  tradeFor: string | null;
  revenue: number | null;
  shippingCost: number | null;
  profit: number | null;
  trackingCarrier: string | null;
  trackingNumber: string | null;
}
