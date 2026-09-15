import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.AIVEN_API_TOKEN?.trim();
  const project = process.env.AIVEN_PROJECT_NAME?.trim();
  const service = process.env.AIVEN_SERVICE_NAME?.trim();

  if (!token || !project || !service) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Aiven en .env (AIVEN_API_TOKEN, AIVEN_PROJECT_NAME, AIVEN_SERVICE_NAME)' },
      { status: 500 }
    );
  }

  const authHeader = token.startsWith('aivenv1 ') || token.startsWith('Bearer ')
    ? token
    : `aivenv1 ${token}`;

  const targetUrl = `https://api.aiven.io/v1/project/${project}/service/${service}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json'
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Aiven Error Status ${res.status}]:`, errText);
      return NextResponse.json(
        { status: 'ERROR', detail: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    const state = data.service?.state;

    if (state === 'RUNNING') {
      return NextResponse.json({ status: 'READY', state });
    }

    if (state === 'POWEROFF') {
      await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ powered: true }),
      });

      return NextResponse.json({ status: 'WAKING_UP', state: 'REBUILDING' });
    }

    return NextResponse.json({ status: 'WAKING_UP', state });
  } catch (error: any) {
    console.error('[Aiven API Exception]:', error, 'Cause:', error.cause);
    return NextResponse.json(
      {
        status: 'ERROR',
        message: error.message,
        cause: error.cause ? String(error.cause) : error.code || 'Desconocido',
      },
      { status: 500 }
    );
  }
}