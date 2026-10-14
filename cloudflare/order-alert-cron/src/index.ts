interface WorkerEnv {
  ALERTS_ENDPOINT_URL: string;
  CRON_SECRET: string;
}

interface ScheduledControllerLike {
  cron: string;
  scheduledTime: number;
  noRetry(): void;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

async function invokeAlerts(env: WorkerEnv) {
  const response = await fetch(env.ALERTS_ENDPOINT_URL, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${env.CRON_SECRET}`,
      'User-Agent': 'Cloudflare-Order-Alert-Cron/1.0',
    },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Alert endpoint returned ${response.status}: ${body}`);
  }

  console.log('[ORDER ALERT] Vercel endpoint response:', body);
}

export default {
  async scheduled(controller: ScheduledControllerLike, env: WorkerEnv, ctx: ExecutionContextLike) {
    console.log(`[ORDER ALERT] Cron triggered: ${controller.cron}`);
    ctx.waitUntil(
      invokeAlerts(env).catch((error) => {
        console.error('[ORDER ALERT] Cron execution failed:', error);
        controller.noRetry();
      }),
    );
  },

  async fetch(request: Request, env: WorkerEnv) {
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    if (request.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    try {
      await invokeAlerts(env);
      return Response.json({ ok: true });
    } catch (error) {
      console.error('[ORDER ALERT] Manual execution failed:', error);
      return Response.json({ ok: false }, { status: 502 });
    }
  },
};
