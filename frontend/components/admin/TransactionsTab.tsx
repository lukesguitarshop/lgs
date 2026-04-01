'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { Transaction, CreateTransactionRequest } from '@/lib/types/transaction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Plus, RefreshCw, Trash2, Loader2, Package } from 'lucide-react';

const PLATFORMS = ['Reverb', 'Cash', 'PayPal', 'eBay', 'Venmo', 'Zelle', 'lukesguitarshop.com', 'Gear Exchange', 'Insurance', 'Restocking Fee'];
const CARRIERS = ['UPS', 'USPS', 'FedEx'];

interface TransactionFormData {
  date: string;
  guitarName: string;
  transactionType: 'sold' | 'traded' | 'for_sale';
  purchasePrice: string;
  soldVia: string;
  tradeFor: string[];
  revenue: string;
  shippingCost: string;
  profit: string;
  trackingCarrier: string;
  trackingNumber: string;
}

const emptyForm: TransactionFormData = {
  date: new Date().toISOString().split('T')[0],
  guitarName: '',
  transactionType: 'sold',
  purchasePrice: '',
  soldVia: '',
  tradeFor: [''],
  revenue: '',
  shippingCost: '',
  profit: '',
  trackingCarrier: '',
  trackingNumber: '',
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function parseCurrencyString(value: string): number | null {
  if (!value || value.trim() === '') return null;
  const cleaned = value.replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(current.trim());
        current = '';
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++;
        }
        row.push(current.trim());
        if (row.some((cell) => cell !== '')) {
          rows.push(row);
        }
        row = [];
        current = '';
      } else {
        current += char;
      }
    }
  }
  // last row
  row.push(current.trim());
  if (row.some((cell) => cell !== '')) {
    rows.push(row);
  }

  return rows;
}

export default function TransactionsTab() {
  const { showToast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [form, setForm] = useState<TransactionFormData>(emptyForm);

  // Import dialog
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState<CreateTransactionRequest[]>([]);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPlatform, setFilterPlatform] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sorting & pagination state
  const [sortColumn, setSortColumn] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  // Get unique platforms for filter dropdown
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    for (const t of transactions) {
      if (t.soldVia) platforms.add(t.soldVia);
    }
    return Array.from(platforms).sort();
  }, [transactions]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== 'all' && t.transactionType !== filterType) return false;
      if (filterPlatform !== 'all' && t.soldVia !== filterPlatform) return false;
      if (searchQuery && !t.guitarName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [transactions, filterType, filterPlatform, searchQuery]);

  const sortedTransactions = useMemo(() => {
    const sorted = [...filteredTransactions].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'date': aVal = a.date; bVal = b.date; break;
        case 'guitarName': aVal = a.guitarName.toLowerCase(); bVal = b.guitarName.toLowerCase(); break;
        case 'purchasePrice': aVal = a.purchasePrice ?? 0; bVal = b.purchasePrice ?? 0; break;
        case 'transactionType': aVal = a.transactionType; bVal = b.transactionType; break;
        case 'soldVia': aVal = a.soldVia ?? (a.tradeFor ? a.tradeFor.join(', ') : ''); bVal = b.soldVia ?? (b.tradeFor ? b.tradeFor.join(', ') : ''); break;
        case 'revenue': aVal = a.revenue ?? 0; bVal = b.revenue ?? 0; break;
        case 'shippingCost': aVal = a.shippingCost ?? 0; bVal = b.shippingCost ?? 0; break;
        case 'profit': aVal = a.profit ?? 0; bVal = b.profit ?? 0; break;
        default: aVal = a.date; bVal = b.date;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredTransactions, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedTransactions.length / PAGE_SIZE);
  const paginatedTransactions = sortedTransactions.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const SortHeader = ({ column, label }: { column: string; label: string }) => (
    <th
      className="text-left py-3 px-3 text-sm font-medium text-gray-600 cursor-pointer hover:bg-[#020E1C]/80 hover:text-white select-none"
      onClick={() => handleSort(column)}
    >
      <span className="flex items-center gap-1">
        {label}
        {sortColumn === column && (
          <span className="text-xs">{sortDirection === 'asc' ? '▲' : '▼'}</span>
        )}
      </span>
    </th>
  );

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.authGet<Transaction[]>('/admin/transactions');
      setTransactions(data);
      setCurrentPage(1);
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
      showToast('Failed to load transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Auto-calculate profit when revenue, purchasePrice, or shippingCost change
  const updateProfit = (updates: Partial<TransactionFormData>, current: TransactionFormData) => {
    const merged = { ...current, ...updates };
    if (merged.transactionType === 'sold') {
      const revenue = parseFloat(merged.revenue) || 0;
      const purchase = parseFloat(merged.purchasePrice) || 0;
      const shipping = parseFloat(merged.shippingCost) || 0;
      const profit = revenue - purchase - shipping;
      return { ...updates, profit: revenue ? profit.toFixed(2) : '' };
    }
    return { ...updates, profit: '' };
  };

  const handleFormChange = (field: keyof TransactionFormData, value: string) => {
    if (field === 'revenue' || field === 'purchasePrice' || field === 'shippingCost') {
      const updates = updateProfit({ [field]: value }, form);
      setForm((prev) => ({ ...prev, ...updates }));
    } else if (field === 'transactionType') {
      const updates = updateProfit(
        {
          transactionType: value as 'sold' | 'traded',
          // Clear fields when switching type
          ...(value === 'traded'
            ? { soldVia: '', revenue: '', shippingCost: '', profit: '' }
            : { tradeFor: [''] }),
        },
        form
      );
      setForm((prev) => ({ ...prev, ...updates }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const openAddDialog = () => {
    setEditingTransaction(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEditDialog = (txn: Transaction) => {
    setEditingTransaction(txn);
    setForm({
      date: txn.date ? txn.date.split('T')[0] : '',
      guitarName: txn.guitarName,
      transactionType: txn.transactionType,
      purchasePrice: txn.purchasePrice !== null ? String(txn.purchasePrice) : '',
      soldVia: txn.soldVia || '',
      tradeFor: txn.tradeFor && txn.tradeFor.length > 0 ? txn.tradeFor : [''],
      revenue: txn.revenue !== null ? String(txn.revenue) : '',
      shippingCost: txn.shippingCost !== null ? String(txn.shippingCost) : '',
      profit: txn.profit !== null ? String(txn.profit) : '',
      trackingCarrier: txn.trackingCarrier || '',
      trackingNumber: txn.trackingNumber || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.guitarName.trim()) {
      showToast('Guitar name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: CreateTransactionRequest = {
        date: form.date,
        guitarName: form.guitarName.trim(),
        transactionType: form.transactionType,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : null,
        soldVia: form.transactionType === 'sold' && form.soldVia ? form.soldVia : null,
        tradeFor: form.transactionType === 'traded' ? form.tradeFor.map(s => s.trim()).filter(s => s.length > 0) : null,
        revenue: form.revenue ? parseFloat(form.revenue) : null,
        shippingCost: form.shippingCost ? parseFloat(form.shippingCost) : null,
        profit: form.profit ? parseFloat(form.profit) : null,
        trackingCarrier: form.trackingCarrier || null,
        trackingNumber: form.trackingNumber.trim() || null,
      };

      if (editingTransaction) {
        await api.authPut(`/admin/transactions/${editingTransaction.id}`, payload);
        showToast('Transaction updated', 'success');
      } else {
        await api.authPost('/admin/transactions', payload);
        showToast('Transaction added', 'success');
      }

      setDialogOpen(false);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to save transaction:', err);
      showToast(
        err instanceof Error ? err.message : 'Failed to save transaction',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, txn: Transaction) => {
    e.stopPropagation();
    if (!window.confirm(`Delete transaction for "${txn.guitarName}"?`)) return;

    try {
      await api.authDelete(`/admin/transactions/${txn.id}`);
      showToast('Transaction deleted', 'success');
      fetchTransactions();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      showToast('Failed to delete transaction', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const rows = parseCSV(text);
      if (rows.length < 2) {
        showToast('CSV file appears empty or has no data rows', 'error');
        return;
      }

      // First row is header, rest is data
      const dataRows = rows.slice(1);
      setCsvPreview(dataRows.slice(0, 10));

      const today = new Date().toISOString().split('T')[0];
      const parsed: CreateTransactionRequest[] = dataRows.map((row) => {
        // CSV columns: Guitar, Purchase Price, Sold/Traded, Transaction Type, Trade For, Revenue, Shipping Cost, Profit
        const guitarName = row[0] || '';
        const purchasePrice = parseCurrencyString(row[1] || '');
        const soldOrTraded = (row[2] || '').trim();
        const transactionTypeCol = (row[3] || '').trim();
        const tradeFor = (row[4] || '').trim() || null;
        const revenue = parseCurrencyString(row[5] || '');
        const shippingCost = parseCurrencyString(row[6] || '');
        const profit = parseCurrencyString(row[7] || '');

        const isTraded = soldOrTraded.toLowerCase() === 'traded';
        let soldVia: string | null = null;
        if (!isTraded && transactionTypeCol) {
          // Map CSV values to platform names
          const platformMap: Record<string, string> = {
            reverb: 'Reverb',
            cash: 'Cash',
            paypal: 'PayPal',
            ebay: 'eBay',
            trade: 'Trade',
          };
          soldVia = platformMap[transactionTypeCol.toLowerCase()] || transactionTypeCol;
        }

        return {
          date: today,
          guitarName,
          purchasePrice,
          transactionType: isTraded ? 'traded' : 'sold',
          soldVia,
          tradeFor: isTraded && tradeFor ? [tradeFor] : null,
          revenue,
          shippingCost,
          profit,
          trackingCarrier: null,
          trackingNumber: null,
        };
      });

      setCsvData(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (csvData.length === 0) return;

    setImporting(true);
    try {
      const result = await api.authPost<{ count: number }>('/admin/transactions/import', {
        transactions: csvData,
      });
      showToast(`Imported ${result.count ?? csvData.length} transactions`, 'success');
      setImportDialogOpen(false);
      setCsvData([]);
      setCsvPreview([]);
      fetchTransactions();
    } catch (err) {
      console.error('Failed to import transactions:', err);
      showToast('Failed to import CSV', 'error');
    } finally {
      setImporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  return (
    <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transactions
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Track guitar sales, trades, and shipping
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchTransactions}
            variant="outline"
            className="text-sm"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button
            onClick={openAddDialog}
            className="text-sm bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Input
          placeholder="Search guitars..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="w-48 h-9 text-sm"
        />
        <Select value={filterType} onValueChange={(val) => { setFilterType(val); setCurrentPage(1); }}>
          <SelectTrigger className="w-36 h-9 text-sm">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="sold">Sold</SelectItem>
            <SelectItem value="traded">Traded</SelectItem>
            <SelectItem value="for_sale">For Sale</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPlatform} onValueChange={(val) => { setFilterPlatform(val); setCurrentPage(1); }}>
          <SelectTrigger className="w-44 h-9 text-sm">
            <SelectValue placeholder="All Platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {availablePlatforms.map(p => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filterType !== 'all' || filterPlatform !== 'all' || searchQuery) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setFilterType('all'); setFilterPlatform('all'); setSearchQuery(''); setCurrentPage(1); }}
            className="text-xs h-9"
          >
            Clear Filters
          </Button>
        )}
        <span className="text-sm text-gray-500 ml-auto">
          {filteredTransactions.length} of {transactions.length} transactions
        </span>
      </div>

      {/* Table */}
      {loading && transactions.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8">
          <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No transactions yet</p>
          <p className="text-gray-400 text-sm">
            Add a transaction or import from CSV
          </p>
        </div>
      ) : (
        <>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <SortHeader column="date" label="Date" />
                <SortHeader column="guitarName" label="Guitar" />
                <SortHeader column="purchasePrice" label="Purchase" />
                <SortHeader column="transactionType" label="Type" />
                <SortHeader column="soldVia" label="Platform / Trade" />
                <SortHeader column="revenue" label="Revenue" />
                <SortHeader column="shippingCost" label="Shipping" />
                <SortHeader column="profit" label="Profit" />
                <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">Tracking</th>
                <th className="text-right py-3 px-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTransactions.map((txn) => (
                <tr
                  key={txn.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openEditDialog(txn)}
                >
                  <td className="py-3 px-3 text-sm text-gray-700">
                    {formatDate(txn.date)}
                  </td>
                  <td className="py-3 px-3 text-sm font-medium text-[#020E1C]">
                    {txn.guitarName}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700 text-right">
                    {formatCurrency(txn.purchasePrice)}
                  </td>
                  <td className="py-3 px-3 text-sm">
                    {txn.transactionType === 'traded' ? (
                      <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        Traded
                      </span>
                    ) : txn.transactionType === 'for_sale' ? (
                      <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
                        For Sale
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        Sold
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700">
                    {txn.transactionType === 'traded'
                      ? (txn.tradeFor && txn.tradeFor.length > 0 ? txn.tradeFor.join(', ') : '—')
                      : txn.soldVia || '—'}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700 text-right">
                    {formatCurrency(txn.revenue)}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700 text-right">
                    {formatCurrency(txn.shippingCost)}
                  </td>
                  <td
                    className={`py-3 px-3 text-sm text-right font-medium ${
                      txn.profit !== null && txn.profit >= 0
                        ? 'text-green-600'
                        : txn.profit !== null
                        ? 'text-red-600'
                        : 'text-gray-400'
                    }`}
                  >
                    {formatCurrency(txn.profit)}
                  </td>
                  <td className="py-3 px-3 text-sm text-gray-700" onClick={(e) => e.stopPropagation()}>
                    {txn.trackingCarrier && txn.trackingNumber
                      ? (() => {
                          const urls: Record<string, string> = {
                            'UPS': `https://www.ups.com/track?tracknum=${txn.trackingNumber}`,
                            'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${txn.trackingNumber}`,
                            'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${txn.trackingNumber}`,
                          };
                          const url = urls[txn.trackingCarrier!];
                          return url ? (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#6E0114] hover:underline">
                              {txn.trackingCarrier}: {txn.trackingNumber}
                            </a>
                          ) : `${txn.trackingCarrier}: ${txn.trackingNumber}`;
                        })()
                      : '—'}
                  </td>
                  <td
                    className="py-3 px-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => handleDelete(e, txn)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-2">
            <span className="text-sm text-gray-600">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, sortedTransactions.length)} of {sortedTransactions.length}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
        </>
      )}

      {/* Add/Edit Transaction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTransaction ? 'Edit Transaction' : 'Add Transaction'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Date */}
            <div className="space-y-1">
              <Label htmlFor="txn-date">Date</Label>
              <Input
                id="txn-date"
                type="date"
                value={form.date}
                onChange={(e) => handleFormChange('date', e.target.value)}
              />
            </div>

            {/* Guitar Name */}
            <div className="space-y-1">
              <Label htmlFor="txn-guitar">Guitar Name *</Label>
              <Input
                id="txn-guitar"
                value={form.guitarName}
                onChange={(e) => handleFormChange('guitarName', e.target.value)}
                placeholder="e.g. 2019 Gibson Les Paul Standard"
              />
            </div>

            {/* Transaction Type */}
            <div className="space-y-1">
              <Label>Transaction Type</Label>
              <Select
                value={form.transactionType}
                onValueChange={(val) => handleFormChange('transactionType', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="traded">Traded</SelectItem>
                  <SelectItem value="for_sale">For Sale</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sold fields */}
            {form.transactionType === 'sold' && (
              <>
                <div className="space-y-1">
                  <Label>Platform</Label>
                  <Select
                    value={form.soldVia}
                    onValueChange={(val) => handleFormChange('soldVia', val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="txn-revenue">Revenue</Label>
                    <Input
                      id="txn-revenue"
                      type="number"
                      step="0.01"
                      value={form.revenue}
                      onChange={(e) => handleFormChange('revenue', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="txn-shipping">Shipping Cost</Label>
                    <Input
                      id="txn-shipping"
                      type="number"
                      step="0.01"
                      value={form.shippingCost}
                      onChange={(e) => handleFormChange('shippingCost', e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Traded fields */}
            {form.transactionType === 'traded' && (
              <div className="space-y-1">
                <Label>Trade For</Label>
                {form.tradeFor.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      value={item}
                      onChange={(e) => {
                        const updated = [...form.tradeFor];
                        updated[idx] = e.target.value;
                        setForm(prev => ({ ...prev, tradeFor: updated }));
                      }}
                      placeholder={`Guitar ${idx + 1}`}
                    />
                    {form.tradeFor.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="px-2 text-red-600 hover:text-red-800 shrink-0"
                        onClick={() => {
                          const updated = form.tradeFor.filter((_, i) => i !== idx);
                          setForm(prev => ({ ...prev, tradeFor: updated }));
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs mt-1"
                  onClick={() => setForm(prev => ({ ...prev, tradeFor: [...prev.tradeFor, ''] }))}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add another guitar
                </Button>
              </div>
            )}

            {/* Purchase Price */}
            <div className="space-y-1">
              <Label htmlFor="txn-purchase">Purchase Price</Label>
              <Input
                id="txn-purchase"
                type="number"
                step="0.01"
                value={form.purchasePrice}
                onChange={(e) => handleFormChange('purchasePrice', e.target.value)}
                placeholder="0.00 (leave blank if from trade)"
              />
            </div>

            {/* Profit (auto-calculated, read-only for sold) */}
            {form.transactionType === 'sold' && form.profit && (
              <div className="space-y-1">
                <Label>Profit (auto-calculated)</Label>
                <Input
                  value={formatCurrency(parseFloat(form.profit))}
                  readOnly
                  className={`${
                    parseFloat(form.profit) >= 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  } bg-gray-50`}
                />
              </div>
            )}

            {/* Tracking */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Tracking Carrier</Label>
                <Select
                  value={form.trackingCarrier}
                  onValueChange={(val) =>
                    handleFormChange('trackingCarrier', val === '__none__' ? '' : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {CARRIERS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="txn-tracking">Tracking Number</Label>
                <Input
                  id="txn-tracking"
                  value={form.trackingNumber}
                  onChange={(e) => handleFormChange('trackingNumber', e.target.value)}
                  placeholder="Tracking number"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTransaction ? 'Update' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import CSV Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Transactions from CSV</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="csv-file">CSV File</Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
              />
              <p className="text-xs text-gray-500 mt-1">
                Expected columns: Guitar, Purchase Price, Sold/Traded, Transaction Type, Trade For, Revenue, Shipping Cost, Profit
              </p>
            </div>

            {csvPreview.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Preview ({csvData.length} rows total, showing first {csvPreview.length})
                </p>
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="py-2 px-2 text-left">Guitar</th>
                        <th className="py-2 px-2 text-left">Purchase</th>
                        <th className="py-2 px-2 text-left">Sold/Traded</th>
                        <th className="py-2 px-2 text-left">Type</th>
                        <th className="py-2 px-2 text-left">Trade For</th>
                        <th className="py-2 px-2 text-right">Revenue</th>
                        <th className="py-2 px-2 text-right">Shipping</th>
                        <th className="py-2 px-2 text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          {row.slice(0, 8).map((cell, j) => (
                            <td
                              key={j}
                              className={`py-1.5 px-2 ${j >= 5 ? 'text-right' : 'text-left'}`}
                            >
                              {cell || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setCsvData([]);
                setCsvPreview([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={csvData.length === 0 || importing}
              className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Import {csvData.length > 0 ? `${csvData.length} Transactions` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
