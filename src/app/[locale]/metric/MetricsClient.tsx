'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function MetricsClient({ metrics }: { metrics: { totalUsers: number; monthlyVisits: number; accessStatus: string } }) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const locale = useLocale();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 shadow-sm">
            <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse"></div>
            <div className="mt-4 h-10 w-full bg-gray-200 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="border border-red-400 rounded-lg p-4 bg-red-50">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="ml-2 text-sm font-medium text-red-800">Error</h3>
          </div>
          <div className="mt-2 text-sm text-red-700">
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4">
        <div className="border border-yellow-400 rounded-lg p-4 bg-yellow-50">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="ml-2 text-sm font-medium text-yellow-800">Access Denied</h3>
          </div>
          <div className="mt-2 text-sm text-yellow-700">
            <p>You do not have permission to view this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="border rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-medium">Total Users</h3>
        <div className="mt-4">
          <p className="text-2xl font-bold">{metrics.totalUsers}</p>
        </div>
      </div>

      <div className="border rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-medium">Monthly Visits</h3>
        <div className="mt-4">
          <p className="text-2xl font-bold">{metrics.monthlyVisits}</p>
        </div>
      </div>

      <div className="border rounded-lg p-4 shadow-sm">
        <h3 className="text-lg font-medium">Access Status</h3>
        <div className="mt-4">
          <p className="text-2xl font-bold">{metrics.accessStatus}</p>
        </div>
      </div>
    </div>
  );
}
