const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3001'; // 10.0.2.2 para emulador Android, localhost para iOS

export interface CheckoutItem {
  productId: string;
  title: string;
  price: number;
  quantity: number;
  image: string;
  size?: string;
  colorName?: string;
}

export async function processSecureCheckout(
  userId: string,
  items: CheckoutItem[],
) {
  if (!items || items.length === 0) {
    throw new Error('El carrito está vacío');
  }

  try {
    const response = await fetch(`${API_URL}/api/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, items }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || data.message || 'Error al procesar el checkout',
      );
    }

    return data; // Retorna { success: true, orderId: "..." }
  } catch (error: any) {
    console.error('❌ [MOBILE CHECKOUT ERROR]:', error.message);
    throw error;
  }
}
