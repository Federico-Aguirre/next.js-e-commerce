import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth-options';
import MetricsClient from './MetricsClient';

export default async function MetricsPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session || session.user?.role !== 'ADMIN') {
    redirect(`/${resolvedParams.locale}/login`);
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

  const metrics = {
    totalUsers,
    monthlyVisits,
    accessStatus: 'Online',
  };

  return <MetricsClient metrics={metrics} />;
}
