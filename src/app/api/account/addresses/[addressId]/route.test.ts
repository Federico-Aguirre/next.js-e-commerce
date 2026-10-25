import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticatedUserMock, prismaMock } = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  prismaMock: {
    deliveryAddress: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/auth/request-user', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  hashRateLimitIdentity: vi.fn((value: string) => value),
}));

import { DELETE, PATCH } from './route';

const body = {
  label: 'Trabajo',
  shippingStreet: 'Av. Corrientes',
  shippingNumber: '1234',
  shippingApartment: '',
  shippingCity: 'CABA',
  shippingProvince: 'Buenos Aires',
  shippingPostalCode: 'C1043',
  shippingCountry: 'Argentina',
  isDefault: true,
};

const context = { params: Promise.resolve({ addressId: 'address-owned-by-another-user' }) };

describe('/api/account/addresses/[addressId] ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    prismaMock.deliveryAddress.findFirst.mockResolvedValue(null);
  });

  it('does not update an address unless it belongs to the authenticated user', async () => {
    const response = await PATCH(
      new Request('https://shop.example/api/account/addresses/address-owned-by-another-user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(prismaMock.deliveryAddress.findFirst).toHaveBeenCalledWith({
      where: { id: 'address-owned-by-another-user', userId: 'user-1' },
      select: { id: true, isDefault: true },
    });
    expect(prismaMock.deliveryAddress.update).not.toHaveBeenCalled();
  });

  it('does not delete an address unless it belongs to the authenticated user', async () => {
    const response = await DELETE(
      new Request('https://shop.example/api/account/addresses/address-owned-by-another-user', {
        method: 'DELETE',
      }),
      context,
    );

    expect(response.status).toBe(404);
    expect(prismaMock.deliveryAddress.findFirst).toHaveBeenCalledWith({
      where: { id: 'address-owned-by-another-user', userId: 'user-1' },
      select: { id: true, isDefault: true },
    });
    expect(prismaMock.deliveryAddress.deleteMany).not.toHaveBeenCalled();
  });
});
