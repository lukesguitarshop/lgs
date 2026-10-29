'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import { ExtraExpense, CreateExtraExpenseRequest } from '@/lib/types/extra-expense';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { Plus, Trash2, Loader2, Pencil } from 'lucide-react';
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/responsive-table';

const EXPENSE_CATEGORIES = [
  'Boxes',
  'Packing Materials',
  'Tool',
  'Guitar Part',
  'Printing Supplies',
  'Carrier Adjustment',
  'Other',
];

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ExtraExpensesTab() {
  const { showToast } = useToast();

  const [expenses, setExpenses] = useState<ExtraExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExtraExpense | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formCost, setFormCost] = useState('');

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

  const sortedExpenses = useMemo(() => {
    const sorted = [...expenses].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case 'date': aVal = a.date; bVal = b.date; break;
        case 'category': aVal = a.category.toLowerCase(); bVal = b.category.toLowerCase(); break;
        case 'cost': aVal = a.cost; bVal = b.cost; break;
        default: aVal = a.date; bVal = b.date;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [expenses, sortColumn, sortDirection]);

  const totalPages = Math.ceil(sortedExpenses.length / PAGE_SIZE);
  const paginatedExpenses = sortedExpenses.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.authGet<ExtraExpense[]>('/admin/extra-expenses');
      setExpenses(data);
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load expenses';
      console.error('Failed to fetch expenses:', message);
      setFetchError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const openAddDialog = () => {
    setEditingExpense(null);
    setFormDate('');
    setFormCategory('');
    setFormCost('');
    setDialogOpen(true);
  };

  const openEditDialog = (expense: ExtraExpense) => {
    setEditingExpense(expense);
    setFormDate(expense.date.split('T')[0]);
    setFormCategory(expense.category);
    setFormCost(expense.cost.toString());
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDate || !formCategory || !formCost) return;

    const payload: CreateExtraExpenseRequest = {
      date: formDate,
      category: formCategory,
      cost: parseFloat(formCost),
    };

    setSaving(true);
    try {
      if (editingExpense) {
        await api.authPut(`/admin/extra-expenses/${editingExpense.id}`, payload);
        showToast('Expense updated', 'success');
      } else {
        await api.authPost('/admin/extra-expenses', payload);
        showToast('Expense added', 'success');
      }
      setDialogOpen(false);
      fetchExpenses();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save expense';
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, expense: ExtraExpense) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this expense?')) return;

    try {
      await api.authDelete(`/admin/extra-expenses/${expense.id}`);
      showToast('Expense deleted', 'success');
      fetchExpenses();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete expense';
      showToast(message, 'error');
    }
  };

  const columns: ResponsiveColumn<ExtraExpense>[] = [
    { id: 'date', header: 'Date', sortKey: 'date', priority: 'key', cell: (expense) => formatDate(expense.date) },
    { id: 'category', header: 'Category', sortKey: 'category', priority: 'primary', cell: (expense) => expense.category },
    {
      id: 'cost',
      header: 'Cost',
      sortKey: 'cost',
      priority: 'key',
      cellClassName: 'text-right',
      cell: (expense) => formatCurrency(expense.cost),
    },
    {
      id: 'actions',
      header: 'Actions',
      priority: 'actions',
      stopRowClick: true,
      headerClassName: 'text-right',
      cellClassName: 'text-right',
      cell: (expense) => (
        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
          onClick={(e) => handleDelete(e, expense)}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      ),
      mobileCell: (expense) => (
        <>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDialog(expense)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => handleDelete(e, expense)}
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </>
      ),
    },
  ];

  // Category subtotals
  const categoryTotals = expenses.reduce<Record<string, number>>((acc, exp) => {
    acc[exp.category] = (acc[exp.category] || 0) + exp.cost;
    return acc;
  }, {});

  const sortedCategories = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const grandTotal = expenses.reduce((sum, exp) => sum + exp.cost, 0);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-[#FFFFF3] rounded-lg border border-gray-200 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-[#020E1C]">Extra Expenses</h2>
          <p className="text-gray-600 text-sm mt-1">
            Track non-transaction expenses like shipping supplies and tools
          </p>
        </div>
        <Button onClick={openAddDialog} className="w-full sm:w-auto bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]">
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
          <strong>Error loading expenses:</strong> {fetchError}
        </div>
      )}

      {/* Loading / Empty / Table */}
      {loading && expenses.length === 0 ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : expenses.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No expenses recorded yet</p>
          <p className="text-gray-400 text-sm">Click &quot;Add Expense&quot; to get started</p>
        </div>
      ) : (
        <>
          <ResponsiveTable
            label="Expenses"
            columns={columns}
            rows={paginatedExpenses}
            rowKey={(expense) => expense.id}
            onRowClick={openEditDialog}
            rowClassName={() => 'border-b border-gray-100 hover:bg-gray-50 cursor-pointer'}
            sort={{ key: sortColumn, direction: sortDirection, onSort: handleSort }}
            tableClassName="w-full"
            headerRowClassName="border-b border-gray-200"
            thClassName="text-left py-3 px-4 text-sm font-medium text-gray-600"
            sortableThClassName="cursor-pointer hover:bg-[#020E1C]/80 hover:text-white select-none"
            tdClassName="py-3 px-4 text-sm text-[#020E1C]"
            mobilePageSize={PAGE_SIZE}
          />
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-4 px-2">
              <span className="text-sm text-gray-600">
                Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, sortedExpenses.length)} of {sortedExpenses.length}
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

          {/* Category Subtotals */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-[#020E1C] mb-3">Category Totals</h3>
            <div className="space-y-1">
              {sortedCategories.map(([category, total]) => (
                <div key={category} className="flex justify-between text-sm text-gray-700 px-4 py-1">
                  <span>{category}</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold text-[#020E1C] px-4 py-2 border-t border-gray-200 mt-2">
                <span>Grand Total</span>
                <span>{formatCurrency(grandTotal)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-category">Category</Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expense-cost">Cost</Label>
              <Input
                id="expense-cost"
                type="number"
                step="0.01"
                min="0"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formDate || !formCategory || !formCost}
              className="bg-[#6E0114] hover:bg-[#580110] text-[#FFFFF3]"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingExpense ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
