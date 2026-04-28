'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft, ArrowLeftRight, BarChart3, Calendar, Receipt, Calculator } from 'lucide-react';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import TransactionsTab from '@/components/admin/TransactionsTab';
import DashboardTab from '@/components/admin/DashboardTab';
import MonthlyBreakdownTab from '@/components/admin/MonthlyBreakdownTab';
import ExtraExpensesTab from '@/components/admin/ExtraExpensesTab';
import FlipCalculatorTab from '@/components/admin/FlipCalculatorTab';

export default function FinancesPage() {
  const { isAdmin, isLoading } = useAuth();
  const [financeTab, setFinanceTab] = useState('transactions');

  useEffect(() => {
    const saved = localStorage.getItem('adminFinanceTab');
    if (saved && ['transactions', 'dashboard', 'monthly', 'expenses', 'flip-calc'].includes(saved)) {
      setFinanceTab(saved);
    }
  }, []);

  const handleFinanceTabChange = (value: string) => {
    setFinanceTab(value);
    localStorage.setItem('adminFinanceTab', value);
  };

  if (isLoading) return null;

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16 px-4">
        <h1 className="text-2xl font-bold text-[#020E1C] mb-4">Admin access required</h1>
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl lg:max-w-6xl xl:max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-[#020E1C] transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">Finances</h1>
      <p className="text-gray-600 mb-6">Transactions, dashboard, monthly breakdown, expenses, flip calculator</p>

      <AdminTabsNav />

      <Tabs value={financeTab} onValueChange={handleFinanceTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-6">
          <TabsTrigger value="transactions" className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="hidden sm:inline">Transactions</span>
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="monthly" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Monthly</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Expenses</span>
          </TabsTrigger>
          <TabsTrigger value="flip-calc" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">Flip Calc</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <TransactionsTab />
        </TabsContent>
        <TabsContent value="dashboard">
          <DashboardTab />
        </TabsContent>
        <TabsContent value="monthly">
          <MonthlyBreakdownTab />
        </TabsContent>
        <TabsContent value="expenses">
          <ExtraExpensesTab />
        </TabsContent>
        <TabsContent value="flip-calc">
          <FlipCalculatorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
