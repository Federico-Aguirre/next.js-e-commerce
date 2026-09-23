import { NextResponse } from 'next/server';

const PAYPAL_API_BASE = 'https://api-m.sandbox.paypal.com';

export async function GET() {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          message: 'Faltan PAYPAL_CLIENT_ID o PAYPAL_CLIENT_SECRET.',
        },
        {
          status: 500,
        },
      );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
      'base64',
    );

    const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body:
        'grant_type=client_credentials' +
        '&response_type=client_token' +
        '&intent=sdk_init',
      cache: 'no-store',
    });

    const data = await response.json();

    if (!response.ok || !data.access_token) {
      console.error('❌ Error obteniendo browser-safe PayPal token:', {
        status: response.status,
        statusText: response.statusText,
        data,
      });

      return NextResponse.json(
        {
          message:
            data?.error_description ||
            data?.message ||
            'PayPal rechazó la autenticación.',
        },
        {
          status: response.status || 500,
        },
      );
    }

    return NextResponse.json({
      accessToken: data.access_token,
    });
  } catch (error: unknown) {
    console.error('❌ Error PayPal client token:', error);

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Error interno de PayPal.',
      },
      {
        status: 500,
      },
    );
  }
}
