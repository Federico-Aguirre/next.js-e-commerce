// src/app/api/aiven-status/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  const token = process.env.AIVEN_API_TOKEN;
  const project = process.env.AIVEN_PROJECT_NAME;
  const service = process.env.AIVEN_SERVICE_NAME;

  if (!token || !project || !service) {
    return NextResponse.json(
      { error: 'Faltan variables de entorno de Aiven (.env.local)' },
      { status: 500 }
    );
  }

  const cleanToken = token.trim();
  const authHeader = cleanToken.startsWith('aivenv1 ') || cleanToken.startsWith('Bearer ')
    ? cleanToken
    : `aivenv1 ${cleanToken}`;

  const targetUrl = `https://api.aiven.io/v1/project/${project.trim()}/service/${service.trim()}`;

  try {
    // 1. Obtener estado actual
    const res = await fetch(targetUrl, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[Aiven Error Status ${res.status}]:`, errText);
      return NextResponse.json({ status: 'ERROR', detail: errText }, { status: res.status });
    }

    const data = await res.json();
    const serviceData = data.service || {};
    const state = serviceData.state;

    console.log(`[Aiven API Check] Estado actual de ${service}: ${state}`);

    // Si ya está funcionando
    if (state === 'RUNNING') {
      return NextResponse.json({ status: 'READY', state });
    }

    // 2. Si la base de datos está en POWEROFF, enviamos la orden oficial de encendido
    if (state === 'POWEROFF') {
      console.log('[Aiven API] Detectado POWEROFF. Enviando orden de encendido (powered: true)...');

      const wakeRes = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
        // En la API v1 de Aiven, powered: true/false enciende o apaga el servicio
        body: JSON.stringify({ powered: true }),
      });

      const wakeResponseBody = await wakeRes.text();
      console.log(`[Aiven Wake Status ${wakeRes.status}]:`, wakeResponseBody);

      return NextResponse.json({ status: 'WAKING_UP', state: 'REBUILDING' });
    }

    // Para cualquier otro estado intermedio (REBUILDING, STARTING, NO_MASTER)
    return NextResponse.json({ status: 'WAKING_UP', state });
  } catch (error: any) {
    console.error('[Aiven API Exception]:', error);
    return NextResponse.json({ status: 'ERROR', message: error.message }, { status: 500 });
  }
}