import { NextResponse } from 'next/server';
import { Env } from '@/lib/Env';
import { sendOverdueOrderAlerts } from '@/lib/order-alerts';
import { expireStaleCheckoutOrders } from '@/lib/orders/expired-checkout-cleanup';
import {
  monitorStaleShipmentCreations,
  refreshInTransitShipments,
  retryOrderEmails,
} from '@/lib/orders/operational-maintenance';

export const maxDuration = 60;

function isAuthorized(request: Request) {
  const authorization = request.headers.get('authorization');
  return Boolean(Env.CRON_SECRET && authorization === `Bearer ${Env.CRON_SECRET}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [alerts, checkoutCleanup, emailRetries, shipmentRefresh, staleShipmentCreations] =
      await Promise.all([
        sendOverdueOrderAlerts(),
        expireStaleCheckoutOrders({ limit: 6 }),
        retryOrderEmails({ limit: 12 }),
        refreshInTransitShipments({ limit: 10 }),
        monitorStaleShipmentCreations({ limit: 20 }),
      ]);

    return NextResponse.json({
      ok: true,
      alerts,
      checkoutCleanup,
      emailRetries,
      shipmentRefresh,
      staleShipmentCreations,
    });
  } catch (error) {
    console.error('[CRON] Operational maintenance job failed:', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
