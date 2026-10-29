'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import { Plus, RefreshCw, Trash2, Loader2, Package, Pencil } from 'lucide-react';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table';
import { CopyButton } from '@/components/ui/copy-button';

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

function profitClass(profit: number | null): string {
  if (profit === null) return 'text-gray-400';
  return profit >= 0 ? 'text-green-600' : 'text-red-600';
}

function trackingUrl(carrier: string, number: string): string | null {
  const urls: Record<string, string> = {
    'UPS': `https://www.ups.com/track?tracknum=${number}`,
    'USPS': `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`,
    'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${number}`,
  };
  return urls[carrier] ?? null;
}

function ActionNeededBadge() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-xs font-medium whitespace-nowrap">
      Action needed
    </span>
  );
}

function TypeBadge({ type }: { type: Transaction['transactionType'] }) {
  if (type === 'traded') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
        Traded
      </span>
    );
  }
  if (type === 'for_sale') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium">
        For Sale
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
      Sold
    </span>
  );
}

// Guitar, Purchase Price, Sold/Traded, Transaction Type, Trade For, Revenue, Shipping Cost, Profit
const CSV_PREVIEW_COLUMNS: ResponsiveColumn<string[]>[] = [
  'Guitar', 'Purchase', 'Sold/Traded', 'Type', 'Trade For', 'Revenue', 'Shipping', 'Profit',
].map((header, j): ResponsiveColumn<string[]> => ({
  id: header,
  header,
  priority: j === 0 ? 'primary' : 'key',
  headerClassName: j >= 5 ? 'text-right' : 'text-left',
  cellClassName: j >= 5 ? 'text-right' : 'text-left',
  cell: (row: string[]) => row[j] || '—',
  mobileCell: (row: string[]) => row[j] || null,
}));

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

// Drop ?editTxn=<id> / ?txn=<id> from the URL so a refresh doesn't reopen the edit modal.
function stripEditTxnParam() {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('editTxn') && !params.has('txn')) return;
  params.delete('editTxn');
  params.delete('txn');
  const qs = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
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

  // Deep-link (?editTxn=<id>) and "action needed" toast
  const [pendingEditTxnId, setPendingEditTxnId] = useState<string | null>(null);
  const [pendingPresetSold, setPendingPresetSold] = useState(true);
  const initialToastShown = useRef(false);

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

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.authGet<Transaction[]>('/admin/transactions');
      setTransactions(data);
      setCurrentPage(1);
      if (!initialToastShown.current) {
        initialToastShown.current = true;
        const needCount = data.filter((t) => t.needsReview).length;
        if (needCount > 0) {
          showToast(
            `${needCount} transaction${needCount === 1 ? '' : 's'} need attention — finish payout details`,
            'info',
            8000
          );
        }
      }
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

  // Read ?editTxn=<id> on mount. The param is only stripped once it has actually
  // been consumed (below), so a remount -- e.g. tabbing away before the
  // transactions finish loading -- doesn't swallow the deep link.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('editTxn');
    const viewId = params.get('txn');
    if (editId) {
      setPendingEditTxnId(editId);
    } else if (viewId) {
      setPendingEditTxnId(viewId);
      setPendingPresetSold(false);
    }
  }, []);

  // Once transactions are loaded, open the edit modal for the deep-linked id.
  // Arriving via the deactivate "Yes" prompt (?editTxn), pre-set the form to sold +
  // today's date so it's already reflected the moment the modal appears (not yet
  // saved). Arriving from a listing's Finances button (?txn), open it as-is.
  useEffect(() => {
    if (!pendingEditTxnId || transactions.length === 0) return;
    const txn = transactions.find((t) => t.id === pendingEditTxnId);
    if (txn) {
      openEditDialog(txn);
      if (pendingPresetSold) {
        const today = new Date().toISOString().split('T')[0];
        setForm((prev) => ({ ...prev, transactionType: 'sold', date: today }));
      }
    }
    setPendingEditTxnId(null);
    stripEditTxnParam();
  }, [pendingEditTxnId, pendingPresetSold, transactions]);

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

  const columns: ResponsiveColumn<Transaction>[] = [
    {
      id: 'date',
      header: 'Date',
      sortKey: 'date',
      priority: 'key',
      cellClassName: 'text-gray-700',
      cell: (txn) => formatDate(txn.date),
    },
    {
      id: 'guitar',
      header: 'Guitar',
      sortKey: 'guitarName',
      priority: 'primary',
      cellClassName: 'font-medium text-[#020E1C]',
      cell: (txn) => (
        <div className="flex items-center gap-2">
          <span>{txn.guitarName}</span>
          {txn.needsReview && <ActionNeededBadge />}
        </div>
      ),
      mobileCell: (txn) => txn.guitarName,
      mobileBadge: (txn) => (txn.needsReview ? <ActionNeededBadge /> : null),
    },
    {
      id: 'purchase',
      header: 'Purchase',
      sortKey: 'purchasePrice',
      priority: 'key',
      cellClassName: 'text-gray-700 text-right',
      isEmpty: (txn) => txn.purchasePrice === null,
      cell: (txn) => formatCurrency(txn.purchasePrice),
    },
    {
      id: 'type',
      header: 'Type',
      sortKey: 'transactionType',
      priority: 'badge',
      cell: (txn) => <TypeBadge type={txn.transactionType} />,
    },
    {
      id: 'platform',
      header: 'Platform / Trade',
      mobileLabel: 'Platform',
      sortKey: 'soldVia',
      priority: 'key',
      cellClassName: 'text-gray-700',
      cell: (txn) =>
        txn.transactionType === 'traded'
          ? (txn.tradeFor && txn.tradeFor.length > 0 ? txn.tradeFor.join(', ') : '—')
          : txn.soldVia || '—',
      mobileCell: (txn) =>
        txn.transactionType === 'traded'
          ? (txn.tradeFor && txn.tradeFor.length > 0 ? `Traded for ${txn.tradeFor.join(', ')}` : null)
          : txn.soldVia,
    },
    {
      id: 'revenue',
      header: 'Revenue',
      mobileLabel: 'Sale price',
      sortKey: 'revenue',
      priority: 'key',
      cellClassName: 'text-gray-700 text-right',
      isEmpty: (txn) => txn.revenue === null,
      cell: (txn) => formatCurrency(txn.revenue),
    },
    {
      id: 'shipping',
      header: 'Shipping',
      sortKey: 'shippingCost',
      priority: 'key',
      cellClassName: 'text-gray-700 text-right',
      isEmpty: (txn) => txn.shippingCost === null,
      emptyLabel: 'No shipping',
      cell: (txn) => formatCurrency(txn.shippingCost),
    },
    {
      id: 'profit',
      header: 'Profit',
      sortKey: 'profit',
      priority: 'key',
      cellClassName: (txn) => `text-right font-medium ${profitClass(txn.profit)}`,
      isEmpty: (txn) => txn.profit === null,
      cell: (txn) => formatCurrency(txn.profit),
      mobileCell: (txn) => <span className={`font-medium ${profitClass(txn.profit)}`}>{formatCurrency(txn.profit)}</span>,
    },
    {
      id: 'tracking',
      header: 'Tracking',
      priority: 'detail',
      wide: true,
      stopRowClick: true,
      cellClassName: 'text-gray-700',
      isEmpty: (txn) => !(txn.trackingCarrier && txn.trackingNumber),
      cell: (txn) => {
        if (!(txn.trackingCarrier && txn.trackingNumber)) return '—';
        const url = trackingUrl(txn.trackingCarrier, txn.trackingNumber);
        return url ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-[#6E0114] hover:underline">
            {txn.trackingCarrier}: {txn.trackingNumber}
          </a>
        ) : `${txn.trackingCarrier}: ${txn.trackingNumber}`;
      },
      mobileCell: (txn) => {
        const url = trackingUrl(txn.trackingCarrier!, txn.trackingNumber!);
        return (
          <div className="flex items-center gap-2">
            {url ? (
              <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 break-all text-[#6E0114] underline">
                {txn.trackingCarrier}: {txn.trackingNumber}
              </a>
            ) : (
              <span className="min-w-0 break-all">{txn.trackingCarrier}: {txn.trackingNumber}</span>
            )}
            <CopyButton value={txn.trackingNumber!} label="Copy tracking number" />
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      priority: 'actions',
      stopRowClick: true,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      cell: (txn) => (
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={(e) => handleDelete(e, txn)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
      mobileCell: (txn) => (
        <>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(txn)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => handleDelete(e, txn)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </>
      ),
    },
  ];

  return (
    <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[#020E1C] flex items-center gap-2">
            <Package className="h-5 w-5" />
            Transactions
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Track guitar sales, trades, and shipping
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <Button
            onClick={fetchTransactions}
            variant="outline"
            className="text-sm flex-1 sm:flex-none"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
          <Button
            onClick={openAddDialog}
            className="text-sm flex-1 sm:flex-none bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
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
          className="w-full sm:w-48 h-11 sm:h-9 text-sm"
        />
        <Select value={filterType} onValueChange={(val) => { setFilterType(val); setCurrentPage(1); }}>
          <SelectTrigger className="w-full sm:w-36 h-11 sm:h-9 text-sm">
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
          <SelectTrigger className="w-full sm:w-44 h-11 sm:h-9 text-sm">
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
            className="text-xs h-11 sm:h-9"
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
        <ResponsiveTable
          label="Transactions"
          columns={columns}
          rows={paginatedTransactions}
          rowKey={(txn) => txn.id}
          onRowClick={openEditDialog}
          rowClassName={(txn) => `border-b border-gray-100 cursor-pointer ${
            txn.needsReview ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-gray-50'
          }`}
          sort={{ key: sortColumn, direction: sortDirection, onSort: handleSort }}
          tableClassName="w-full"
          headerRowClassName="border-b border-gray-200"
          thClassName="text-left py-3 px-3 text-sm font-medium text-gray-600"
          sortableThClassName="cursor-pointer hover:bg-[#020E1C]/80 hover:text-white select-none"
          tdClassName="py-3 px-3 text-sm"
          mobilePageSize={PAGE_SIZE}
        />
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-2 mt-4 px-2">
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
                <ResponsiveTable
                  label="CSV preview"
                  columns={CSV_PREVIEW_COLUMNS}
                  rows={csvPreview}
                  rowKey={(_, i) => String(i)}
                  rowClassName={() => 'border-b border-gray-100'}
                  containerClassName="border rounded"
                  tableClassName="w-full text-xs"
                  headerRowClassName="border-b bg-gray-50"
                  thClassName="py-2 px-2"
                  tdClassName="py-1.5 px-2"
                  surfaceClassName="bg-background"
                />
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
