'use client';

import { useLayoutEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { ArrowLeft } from 'lucide-react';
import { resolveFinanceTab } from '@/lib/finance-tab';
import { setAdminTab, useAdminTab } from '@/lib/admin-nav';
import TransactionsTab from '@/components/admin/TransactionsTab';
import DashboardTab from '@/components/admin/DashboardTab';
import MonthlyBreakdownTab from '@/components/admin/MonthlyBreakdownTab';
import ExtraExpensesTab from '@/components/admin/ExtraExpensesTab';
import FlipCalculatorTab from '@/components/admin/FlipCalculatorTab';

export default function FinancesPage() {
  const { isAdmin, isLoading } = useAuth();
  // Shared with the desktop sidebar, which restores the last-used tab on its own.
  const financeTab = useAdminTab('finances');

  // A deep link (?editTxn=<id> or ?txn=<id>) has to win over the last-used tab --
  // otherwise the restored tab unmounts TransactionsTab and the link is dropped.
  useLayoutEffect(() => {
    setAdminTab('finances', resolveFinanceTab(window.location.search, localStorage.getItem('adminFinanceTab')));
  }, []);

  const handleFinanceTabChange = (value: string) => setAdminTab('finances', value);

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
      <Tabs value={financeTab} onValueChange={handleFinanceTabChange} className="w-full">
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
