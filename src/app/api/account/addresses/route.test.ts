import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticatedUserMock, prismaMock, txMock } = vi.hoisted(() => {
  const tx = {
    deliveryAddress: {
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    user: { update: vi.fn() },
  };
  return {
    getAuthenticatedUserMock: vi.fn(),
    txMock: tx,
    prismaMock: {
      deliveryAddress: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        deleteMany: vi.fn(),
      },
      user: { update: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock('@/lib/auth/request-user', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })),
  hashRateLimitIdentity: vi.fn((value: string) => value),
}));

import { GET, POST } from './route';

const addressPayload = {
  label: 'Casa',
  shippingStreet: 'Av. Corrientes',
  shippingNumber: '1234',
  shippingApartment: '',
  shippingCity: 'CABA',
  shippingProvince: 'Buenos Aires',
  shippingPostalCode: 'C1043',
  shippingCountry: 'Argentina',
  isDefault: true,
};

describe('/api/account/addresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthenticatedUserMock.mockResolvedValue({ id: 'user-1' });
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) =>
      callback(txMock),
    );
  });

  it('only lists addresses belonging to the authenticated user and prevents caching', async () => {
    prismaMock.deliveryAddress.findMany.mockResolvedValue([{ id: 'address-1', userId: 'user-1' }]);

    const response = await GET(new Request('https://shop.example/api/account/addresses'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(prismaMock.deliveryAddress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('creates the first saved address as default and synchronizes the legacy profile fields', async () => {
    txMock.deliveryAddress.count.mockResolvedValue(0);
    txMock.deliveryAddress.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'address-1',
        ...data,
      }),
    );

    const response = await POST(
      new Request('https://shop.example/api/account/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addressPayload),
      }),
    );

    expect(response.status).toBe(201);
    expect(txMock.deliveryAddress.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          label: 'Casa',
          isDefault: true,
          shippingStreet: 'Av. Corrientes',
        }),
      }),
    );
    expect(txMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({
          shippingStreet: 'Av. Corrientes',
          shippingCity: 'CABA',
        }),
      }),
    );
  });

  it('rejects unauthenticated requests without querying saved addresses', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);

    const response = await GET(new Request('https://shop.example/api/account/addresses'));

    expect(response.status).toBe(401);
    expect(prismaMock.deliveryAddress.findMany).not.toHaveBeenCalled();
  });
});
