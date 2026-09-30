'use client';

import { AlertCircle } from 'lucide-react';
import { getServerSession } from 'next-auth';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { authOptions } from '@/lib/auth-options';

export default function MetricsPage({ params }: { params: Promise<{ locale: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ locale: string } | null>(null);
  const [metrics, setMetrics] = useState<{
    totalUsers: number;
    monthlyVisits: number;
    accessStatus: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    async function fetchParams() {
      const resolved = await params;
      setResolvedParams(resolved);
    }
    fetchParams();
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) {
      return;
    }

    async function checkAuthAndFetchMetrics() {
      try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== 'ADMIN') {
          router.push(`/${resolvedParams.locale}/login`);
          return;
        }

        // Fetch metrics from PostHog
        const postHogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
        const postHogResponse = await fetch(`${postHogHost}/api/projects/1/events?limit=100`, {
          headers: {
            Authorization: `Bearer ${process.env.POSTHOG_API_KEY}`,
          },
        });

        let monthlyVisits = 0;
        if (postHogResponse.ok) {
          const postHogData = await postHogResponse.json();
          monthlyVisits = postHogData.results.length;
        } else {
          console.error('Failed to fetch from PostHog, using fallback data');
        }

        // Fetch total users from Prisma
        const prismaResponse = await fetch('/api/users/count');
        const prismaData = await prismaResponse.json();
        const totalUsers = prismaData.count;

        setMetrics({
          totalUsers,
          monthlyVisits,
          accessStatus: 'Online',
        });
      } catch (error) {
        setError('Failed to load metrics. Please try again later.');
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    }

    checkAuthAndFetchMetrics();
  }, [resolvedParams, router]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>You do not have permission to view this page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Total Users</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.totalUsers}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Monthly Visits</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.monthlyVisits}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{metrics.accessStatus}</p>
        </CardContent>
      </Card>
    </div>
  );
}
