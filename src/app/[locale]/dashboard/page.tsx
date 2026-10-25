import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { getDashboardAdmin, getDashboardData, getPlatformOwner } from './data';

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ planPayment?: string }>;
}) {
  const { locale } = await params;
  const admin = await getDashboardAdmin();

  if (!admin) {
    redirect(`/${locale}/sign-in`);
  }

  const [platformOwner, query] = await Promise.all([
    getPlatformOwner(),
    searchParams ?? Promise.resolve({ planPayment: undefined }),
  ]);
  const canManagePaymentConnections = Boolean(platformOwner);
  const data = await getDashboardData(canManagePaymentConnections);
  const planPaymentStatus =
    query.planPayment === 'success' ||
    query.planPayment === 'cancelled' ||
    query.planPayment === 'storeClosed'
      ? query.planPayment
      : null;

  return (
    <DashboardClient
      data={data}
      canManagePaymentConnections={canManagePaymentConnections}
      planPaymentStatus={planPaymentStatus}
    />
  );
}
