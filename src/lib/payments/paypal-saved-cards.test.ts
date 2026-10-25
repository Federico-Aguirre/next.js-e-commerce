import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    paymentCustomer: { findUnique: vi.fn(), upsert: vi.fn() },
    savedPaymentMethod: { deleteMany: vi.fn(), upsert: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/payments/platform-config', () => ({
  paypalAuthAssertion: vi.fn(() => 'test-auth-assertion'),
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import {
  buildPayPalOrderCardSource,
  getLocalPayPalSavedCards,
  getPayPalCardBrandLabel,
  getPayPalSavedCardScope,
  getPayPalSandboxAccessToken,
  getPayPalVaultHeaders,
  persistPayPalVaultCard,
  persistPayPalVaultCustomer,
} from './paypal-saved-cards';

const config = {
  clientId: 'sandbox-client-id',
  clientSecret: 'sandbox-client-secret',
  sellerMerchantId: 'seller-sandbox-id',
  partnerAttributionId: 'partner-sandbox-code',
  splitEnabled: true,
  sandbox: true,
};
const customerRow = {
  id: 'local-paypal-customer-1',
  userId: 'user-1',
  provider: 'PAYPAL',
  accountScope: getPayPalSavedCardScope(config.sellerMerchantId),
  externalCustomerId: 'paypal-customer-1',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('PayPal saved-card vault helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    prismaMock.paymentCustomer.findUnique.mockResolvedValue(null);
    prismaMock.paymentCustomer.upsert.mockResolvedValue(customerRow);
    prismaMock.savedPaymentMethod.deleteMany.mockResolvedValue({ count: 0 });
    prismaMock.savedPaymentMethod.upsert.mockResolvedValue({ id: 'local-card-1' });
  });

  it('scopes saved cards to the connected seller without exposing the seller ID', () => {
    const scope = getPayPalSavedCardScope('seller-a');
    expect(scope).toMatch(/^sandbox-seller-[a-f0-9]{24}$/);
    expect(scope).toBe(getPayPalSavedCardScope('seller-a'));
    expect(scope).not.toBe(getPayPalSavedCardScope('seller-b'));
    expect(scope).not.toContain('seller-a');
  });

  it('formats provider card brands without retaining sensitive card fields', () => {
    expect(getPayPalCardBrandLabel('VISA')).toBe('Visa');
    expect(getPayPalCardBrandLabel(null)).toBe('Tarjeta');
  });

  it('does not add vault instructions unless the buyer explicitly opts in', () => {
    expect(buildPayPalOrderCardSource({ savePaymentMethod: false })).toBeUndefined();
    expect(buildPayPalOrderCardSource({ savePaymentMethod: true })).toEqual({
      card: {
        attributes: {
          vault: {
            store_in_vault: 'ON_SUCCESS',
            usage_type: 'PLATFORM',
            customer_type: 'CONSUMER',
            permit_multiple_payment_tokens: true,
          },
        },
      },
    });
    expect(
      buildPayPalOrderCardSource({
        savePaymentMethod: true,
        existingCustomerId: 'paypal-customer-1',
      }),
    ).toMatchObject({
      card: { attributes: { customer: { id: 'paypal-customer-1' } } },
    });
  });

  it('builds a later order with the selected PayPal vault ID only', () => {
    expect(
      buildPayPalOrderCardSource({
        savePaymentMethod: false,
        savedPaymentMethodId: 'vault-card-1',
      }),
    ).toEqual({
      card: { vault_id: 'vault-card-1' },
    });
  });

  it('gets a sandbox access token using server-only credentials', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ access_token: 'oauth-token' }));
    await expect(getPayPalSandboxAccessToken(config)).resolves.toBe('oauth-token');
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      'https://api-m.sandbox.paypal.com/v1/oauth2/token',
    );
    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      cache: 'no-store',
    });
    expect(String((vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit).headers)).not.toContain(
      'sandbox-client-secret',
    );
  });

  it('refuses to request a vault token outside a connected sandbox', async () => {
    await expect(getPayPalSandboxAccessToken({ ...config, sandbox: false })).rejects.toThrow(
      /sandbox/i,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('adds partner attribution and the seller assertion to Vault API requests', () => {
    expect(getPayPalVaultHeaders(config, 'oauth-token')).toEqual({
      Authorization: 'Bearer oauth-token',
      'Content-Type': 'application/json',
      'PayPal-Partner-Attribution-Id': 'partner-sandbox-code',
      'PayPal-Auth-Assertion': 'test-auth-assertion',
    });
  });

  it('links the provider customer to one authenticated user before storing a vault card', async () => {
    prismaMock.paymentCustomer.findUnique
      .mockResolvedValueOnce(null) // no other local user owns this provider customer
      .mockResolvedValueOnce(null); // this user has no PayPal customer row yet

    const result = await persistPayPalVaultCard({
      userId: 'user-1',
      sellerMerchantId: config.sellerMerchantId,
      card: {
        id: 'vault-card-1',
        customerId: 'paypal-customer-1',
        brand: 'VISA',
        lastDigits: '4242',
        expiry: '2030-12',
      },
    });

    expect(result).toEqual({ id: 'local-card-1' });
    expect(prismaMock.paymentCustomer.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: 'user-1',
          provider: 'PAYPAL',
          externalCustomerId: 'paypal-customer-1',
        }),
      }),
    );
    expect(prismaMock.savedPaymentMethod.upsert).toHaveBeenCalledWith({
      where: {
        paymentCustomerId_externalCardId: {
          paymentCustomerId: customerRow.id,
          externalCardId: 'vault-card-1',
        },
      },
      create: {
        paymentCustomerId: customerRow.id,
        externalCardId: 'vault-card-1',
        paymentMethodId: 'card',
        paymentType: 'card',
        paymentMethodName: 'VISA',
        lastFourDigits: '4242',
        expirationMonth: 12,
        expirationYear: 2030,
      },
      update: {
        paymentMethodId: 'card',
        paymentType: 'card',
        paymentMethodName: 'VISA',
        lastFourDigits: '4242',
        expirationMonth: 12,
        expirationYear: 2030,
      },
    });
  });

  it('refuses to assign a provider customer already mapped to another local user', async () => {
    prismaMock.paymentCustomer.findUnique.mockResolvedValueOnce({
      ...customerRow,
      userId: 'other-user',
    });
    await expect(
      persistPayPalVaultCustomer({
        userId: 'user-1',
        sellerMerchantId: config.sellerMerchantId,
        customerId: 'paypal-customer-1',
      }),
    ).rejects.toThrow(/another local user/i);
    expect(prismaMock.paymentCustomer.upsert).not.toHaveBeenCalled();
  });

  it('returns only masked card data for the authenticated user and configured seller', async () => {
    prismaMock.paymentCustomer.findUnique.mockResolvedValueOnce({
      ...customerRow,
      cards: [
        {
          id: 'local-card-1',
          paymentMethodName: 'VISA',
          lastFourDigits: '4242',
          expirationMonth: 12,
          expirationYear: 2030,
        },
      ],
    });

    const result = await getLocalPayPalSavedCards('user-1', customerRow.accountScope);
    expect(result.cards).toEqual([
      {
        id: 'local-card-1',
        brand: 'Visa',
        lastFourDigits: '4242',
        expirationMonth: 12,
        expirationYear: 2030,
      },
    ]);
    expect(JSON.stringify(result.cards)).not.toContain('paypal-customer-1');
  });
});
