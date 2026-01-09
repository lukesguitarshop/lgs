'use client';

import { useState, useEffect } from 'react';
import { use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import PriceHistoryChart from '@/components/charts/PriceHistoryChart';
import PriceRangeChart from '@/components/charts/PriceRangeChart';
import { Guitar, ConditionNames, formatDate, formatPrice } from '@/types/guitar';

export default function GuitarDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [guitar, setGuitar] = useState<Guitar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuitar();
  }, [resolvedParams.id]);

  const fetchGuitar = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<Guitar>(`/guitars/${resolvedParams.id}`);
      setGuitar(response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch guitar details');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading guitar details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
        <Link href="/guitars" className="text-blue-600 hover:text-blue-700 font-semibold">
          ← Back to guitars
        </Link>
      </div>
    );
  }

  if (!guitar) {
    return (
      <div className="max-w-7xl mx-auto">
        <p className="text-gray-600">Guitar not found</p>
        <Link href="/guitars" className="text-blue-600 hover:text-blue-700 font-semibold">
          ← Back to guitars
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <Link href="/guitars" className="text-blue-600 hover:text-blue-700 font-semibold mb-6 inline-block">
        ← Back to guitars
      </Link>

      <div className="bg-white rounded-lg shadow-md p-8 mb-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {guitar.brand} {guitar.model}
            </h1>
            <div className="flex gap-4 text-gray-600">
              {guitar.year && <span>Year: {guitar.year}</span>}
              <span>Category: {guitar.category}</span>
              {guitar.finish && <span>Finish: {guitar.finish}</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-200">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Price Snapshots</p>
            <p className="text-2xl font-bold text-gray-900">{guitar.priceHistory?.length || 0}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Created</p>
            <p className="text-lg font-semibold text-gray-900">{formatDate(guitar.createdAt)}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Last Updated</p>
            <p className="text-lg font-semibold text-gray-900">{formatDate(guitar.updatedAt)}</p>
          </div>
        </div>
      </div>

      {guitar.priceHistory && guitar.priceHistory.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <PriceHistoryChart priceHistory={guitar.priceHistory} />
          <PriceRangeChart priceHistory={guitar.priceHistory} />
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Detailed Price History</h2>

        {!guitar.priceHistory || guitar.priceHistory.length === 0 ? (
          <p className="text-gray-600">No price history available</p>
        ) : (
          <div className="space-y-6">
            {guitar.priceHistory.map((snapshot, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {formatDate(snapshot.date)}
                  </h3>
                  <div className="text-sm text-gray-600">
                    {snapshot.totalListingsScraped} listings scraped
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {snapshot.conditionPricing.map((conditionPrice, condIndex) => {
                    const hasData = conditionPrice.averagePrice !== null;
                    return (
                      <div
                        key={condIndex}
                        className={`p-4 rounded-lg ${
                          hasData ? 'bg-blue-50 border border-blue-200' : 'bg-gray-50 border border-gray-200'
                        }`}
                      >
                        <p className={`text-sm font-medium mb-2 ${hasData ? 'text-blue-900' : 'text-gray-500'}`}>
                          {ConditionNames[conditionPrice.condition] || 'Unknown'}
                        </p>
                        {hasData ? (
                          <>
                            <p className="text-2xl font-bold text-gray-900 mb-2">
                              {formatPrice(conditionPrice.averagePrice)}
                            </p>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>Min: {formatPrice(conditionPrice.minPrice)}</div>
                              <div>Max: {formatPrice(conditionPrice.maxPrice)}</div>
                              <div>{conditionPrice.listingCount} listing{conditionPrice.listingCount !== 1 ? 's' : ''}</div>
                            </div>
                          </>
                        ) : (
                          <p className="text-sm text-gray-500">No data</p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-xs text-gray-500 mt-4">
                  Scraped at: {new Date(snapshot.scrapedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
