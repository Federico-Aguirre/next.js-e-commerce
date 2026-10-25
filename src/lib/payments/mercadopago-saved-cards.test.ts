import { describe, expect, it } from 'vitest';
import {
  getMercadoPagoSandboxCustomerEmail,
  getMercadoPagoSavedCardScope,
  getSavedCardBrandLabel,
} from './mercadopago-saved-cards';

describe('Mercado Pago saved-card helpers', () => {
  it('creates a stable sandbox customer email using the required format', () => {
    const email = getMercadoPagoSandboxCustomerEmail('user-123');

    expect(email).toMatch(/^test_payer_\d{1,10}@testuser\.com$/);
    expect(getMercadoPagoSandboxCustomerEmail('user-123')).toBe(email);
    expect(getMercadoPagoSandboxCustomerEmail('user-456')).not.toBe(email);
  });

  it('isolates saved-card records by connected seller account', () => {
    const first = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-token-one',
      splitEnabled: true,
      externalAccountId: 'seller-1',
    });
    const sameSellerAfterTokenRefresh = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-token-refreshed',
      splitEnabled: true,
      externalAccountId: 'seller-1',
    });
    const anotherSeller = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-token-one',
      splitEnabled: true,
      externalAccountId: 'seller-2',
    });

    expect(first).toBe(sameSellerAfterTokenRefresh);
    expect(first).not.toBe(anotherSeller);
    expect(first).not.toContain('sandbox-token-one');
  });

  it('isolates standalone cards using a one-way token fingerprint', () => {
    const first = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-token-one',
      splitEnabled: false,
    });
    const sameToken = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-token-one',
      splitEnabled: false,
    });
    const anotherToken = getMercadoPagoSavedCardScope({
      accessToken: 'sandbox-token-two',
      splitEnabled: false,
    });

    expect(first).toBe(sameToken);
    expect(first).not.toBe(anotherToken);
    expect(first).not.toContain('sandbox-token-one');
  });

  it('formats provider card labels without assuming a particular brand', () => {
    expect(getSavedCardBrandLabel('master')).toBe('Master');
    expect(getSavedCardBrandLabel('american_express')).toBe('American express');
    expect(getSavedCardBrandLabel()).toBe('Tarjeta');
  });
});
