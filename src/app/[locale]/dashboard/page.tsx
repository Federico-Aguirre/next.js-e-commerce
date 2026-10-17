import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { getDashboardAdmin, getDashboardData, getPlatformOwner } from './data';

export const dynamic = 'force-dynamic';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const admin = await getDashboardAdmin();

  if (!admin) {
    redirect(`/${locale}/sign-in`);
  }

  const platformOwner = await getPlatformOwner();
  const canManagePaymentConnections = Boolean(platformOwner);
  const data = await getDashboardData(canManagePaymentConnections);

  return <DashboardClient data={data} canManagePaymentConnections={canManagePaymentConnections} />;
}
