'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  checkoutSchema,
  type CheckoutFormData,
  type FormErrors,
} from '@/lib/checkout/checkoutSchema';
import { processCardPayment } from '@/lib/checkout/processCardPayment';
import { useCartStore } from '@/store/useCartStore';

export function useDirectCardCheckout() {
  const router = useRouter();

  const cartItems = useCartStore((state) => state.cart);

  const clearCart = useCartStore((state) => state.clearCart);

  const [formData, setFormData] = useState<CheckoutFormData>({
    cardNumber: '',
    cardholderName: '',
    cardExpirationMonth: '',
    cardExpirationYear: '',
    securityCode: '',
    email: '',
    docType: 'DNI',
    docNumber: '',
    installments: '1',
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [loading, setLoading] = useState(false);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.price * item.quantity,
    0,
  );

  const handleAutofill = () => {
    setFormData({
      cardNumber: '5031755734530604',
      cardholderName: 'APRO',
      cardExpirationMonth: '11',
      cardExpirationYear: '2030',
      securityCode: '123',
      email: 'test@testuser.com',
      docType: 'DNI',
      docNumber: '12345678',
      installments: '1',
    });

    setFormErrors({});
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));

    setFormErrors((previous) => {
      if (!(name in previous)) {
        return previous;
      }

      const nextErrors = { ...previous };

      delete nextErrors[name as keyof CheckoutFormData];

      return nextErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      alert('El carrito está vacío.');
      return;
    }

    const validationResult = checkoutSchema.safeParse(formData);

    if (!validationResult.success) {
      const errors: FormErrors = {};

      validationResult.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof CheckoutFormData;

        if (!errors[field]) {
          errors[field] = issue.message;
        }
      });

      setFormErrors(errors);
      return;
    }

    const validatedData = validationResult.data;

    setFormErrors({});
    setLoading(true);

    try {
      const result = await processCardPayment({
        formData: validatedData,
        cartItems,
        cartTotal,
      });

      const paymentSuccessful =
        result.status === 'processed' && result.status_detail === 'accredited';

      if (!paymentSuccessful) {
        alert(
          `Estado del pago: ${result.status} (${
            result.status_detail || result.message || 'Sin detalles'
          })`,
        );

        return;
      }

      if (result.id) {
        const confirmResponse = await fetch('/api/orders/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentId: result.id,
            orderId: result.order_id,
            total: cartTotal,
            items: cartItems.map((item) => ({
              id: item.id,
              articleId: item.articleId,
              title: item.title,
              price: item.price,
              image: item.image,
              colorName: item.colorName,
              size: item.size,
              quantity: item.quantity,
            })),
          }),
        });
      }

      localStorage.removeItem('last_pending_order_id');

      alert(`¡Compra realizada con éxito!`);

      clearCart();

      // Solo se llega acá si el pago fue exitoso
      // y la orden pudo ser confirmada.
      router.replace('/historial');
    } catch (error: unknown) {
      console.error('Error procesando el pago:', error);

      if (error instanceof Error) {
        alert(`Error: ${error.message}`);
      } else {
        alert('Error de procesamiento.');
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    cartItems,
    cartTotal,
    formData,
    formErrors,
    loading,
    handleAutofill,
    handleChange,
    handleSubmit,
  };
}
