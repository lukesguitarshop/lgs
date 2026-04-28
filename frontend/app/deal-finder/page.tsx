'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { AdminTabsNav } from '@/components/admin/AdminTabsNav';
import { DealFinderTab } from '@/components/admin/DealFinderTab';
import { SweetwaterDealFinderTab } from '@/components/admin/SweetwaterDealFinderTab';

export default function DealFinderPage() {
  const { isAdmin, isLoading } = useAuth();

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

      <h1 className="text-3xl font-bold text-[#020E1C] mb-2">Deal Finder</h1>
      <p className="text-gray-600 mb-6">Scan Reverb and Sweetwater for under-priced listings</p>

      <AdminTabsNav />

      <DealFinderTab />
      <div className="mt-6">
        <SweetwaterDealFinderTab />
      </div>
    </div>
  );
}
