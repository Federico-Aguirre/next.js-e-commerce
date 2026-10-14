import { NextResponse } from 'next/server';
import { Env } from '@/lib/Env';
import { sendOverdueOrderAlerts } from '@/lib/order-alerts';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
  const authorization = request.headers.get('authorization');
  return Boolean(Env.CRON_SECRET && authorization === `Bearer ${Env.CRON_SECRET}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sendOverdueOrderAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[CRON] Order alert job failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
