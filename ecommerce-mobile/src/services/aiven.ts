// Usa la IP de tu PC o tu variable de entorno en .env (ej. EXPO_PUBLIC_API_URL)
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.X.X:3001';

export interface AivenStatusResponse {
  status: 'READY' | 'WAKING_UP' | 'ERROR';
  state?: string;
  detail?: string;
  message?: string;
}

export async function triggerAivenWakeUp(): Promise<AivenStatusResponse> {
  try {
    const response = await fetch(`${BASE_URL}/api/aiven-status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
    });

    const data: AivenStatusResponse = await response.json();

    if (!response.ok) {
      console.error('[Aiven Error Mobile]:', data);
      return { status: 'ERROR', message: data.detail || data.message || 'Error en el servidor' };
    }

    return data;
  } catch (error: any) {
    console.error('[Error de red al conectar con Next.js]:', error);
    return {
      status: 'ERROR',
      message: 'No se pudo conectar con el servidor. Verifica que Next.js esté corriendo en la IP correcta.',
    };
  }
}