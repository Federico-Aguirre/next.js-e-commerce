'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loadMercadoPago } from '@mercadopago/sdk-js';

export default function DirectCardCheckoutPage() {
  const router = useRouter();
  const amountToPay = 1000;

  const [formData, setFormData] = useState({
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

  const [loading, setLoading] = useState(false);

  const handleAutofill = () => {
    setFormData({
      cardNumber: '5031755734530604',
      cardholderName: 'APRO',
      cardExpirationMonth: '11',
      cardExpirationYear: '2030',
      securityCode: '123',
      email: 'comprador_test@gmail.com',
      docType: 'DNI',
      docNumber: '12345678',
      installments: '1',
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Cargar el SDK cliente
      await loadMercadoPago();

      const mp = new (window as any).MercadoPago(
        process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY,
        { locale: 'es-AR' }
      );

      // 2. Tokenizar la tarjeta directamente en el navegador
      const tokenResponse = await mp.createCardToken({
        cardNumber: formData.cardNumber.replace(/\s+/g, ''),
        cardholderName: formData.cardholderName,
        cardExpirationMonth: formData.cardExpirationMonth,
        cardExpirationYear: formData.cardExpirationYear,
        securityCode: formData.securityCode,
        identificationType: formData.docType,
        identificationNumber: formData.docNumber,
      });

      if (!tokenResponse?.id) {
        throw new Error('No se pudo tokenizar la tarjeta.');
      }

      // 3. Enviar el token recibido al backend
      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenResponse.id,
          transaction_amount: amountToPay,
          payment_method_id: 'master',
          description: 'Prueba de pago directo auto-rellenado',
          email: formData.email,
          docType: formData.docType,
          docNumber: formData.docNumber,
          installments: formData.installments,
        }),
      });

      const result = await response.json();

      if (result.status === 'approved') {
        alert(`¡Pago Aprobado con éxito! ID: ${result.id}`);
        router.push('/checkout/success');
      } else {
        alert(`Estado del pago: ${result.status} (${result.status_detail || result.message})`);
      }
    } catch (error: any) {
      console.error('Error procesando el pago:', error);
      alert(`Error: ${error.message || 'Error de procesamiento'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '480px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Pago Directo con Tarjeta (Sandbox)</h2>

      <button
        type="button"
        onClick={handleAutofill}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#ffec3d',
          border: '1px solid #d4b106',
          borderRadius: '6px',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '20px',
        }}
      >
        ⚡ Autocompletar todo con tarjeta de prueba
      </button>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Número de Tarjeta</label>
          <input
            type="text"
            name="cardNumber"
            value={formData.cardNumber}
            onChange={handleChange}
            placeholder="5031 7557 3453 0604"
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Nombre del Titular</label>
          <input
            type="text"
            name="cardholderName"
            value={formData.cardholderName}
            onChange={handleChange}
            placeholder="APRO"
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Mes (MM)</label>
            <input
              type="text"
              name="cardExpirationMonth"
              value={formData.cardExpirationMonth}
              onChange={handleChange}
              placeholder="11"
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Año (YYYY)</label>
            <input
              type="text"
              name="cardExpirationYear"
              value={formData.cardExpirationYear}
              onChange={handleChange}
              placeholder="2030"
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>CVV</label>
            <input
              type="text"
              name="securityCode"
              value={formData.securityCode}
              onChange={handleChange}
              placeholder="123"
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="comprador_test@gmail.com"
            required
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ width: '30%' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Tipo Doc</label>
            <select
              name="docType"
              value={formData.docType}
              onChange={handleChange}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            >
              <option value="DNI">DNI</option>
            </select>
          </div>
          <div style={{ width: '70%' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold' }}>Número Doc</label>
            <input
              type="text"
              name="docNumber"
              value={formData.docNumber}
              onChange={handleChange}
              placeholder="12345678"
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '10px',
            padding: '12px',
            backgroundColor: '#1890ff',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Procesando...' : `Pagar $${amountToPay}`}
        </button>
      </form>
    </div>
  );
}