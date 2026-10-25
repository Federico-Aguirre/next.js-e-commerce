import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthenticatedUserMock, prismaMock } = vi.hoisted(() => ({
  getAuthenticatedUserMock: vi.fn(),
  prismaMock: { user: { findUnique: vi.fn(), update: vi.fn() } },
}));

vi.mock('@/lib/auth/request-user', () => ({
  getAuthenticatedUser: getAuthenticatedUserMock,
}));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { GET } from './route';

describe('/api/account cache policy', () => {
  beforeEach(() => {
    getAuthenticatedUserMock.mockReset();
    prismaMock.user.findUnique.mockReset();
    getAuthenticatedUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.test',
      name: 'Test Customer',
      isAdmin: false,
      isPlatformOwner: false,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      firstName: 'Test',
      lastName: 'Customer',
      phone: null,
      dni: null,
      shippingStreet: 'Street',
      shippingNumber: '123',
      shippingApartment: null,
      shippingCity: 'City',
      shippingProvince: 'Province',
      shippingPostalCode: '1000',
      shippingCountry: 'AR',
    });
  });

  it('marks authenticated profile data private and uncacheable', async () => {
    const response = await GET(new Request('https://shop.example/api/account'));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(await response.json()).toMatchObject({ firstName: 'Test', shippingCountry: 'AR' });
  });

  it('also prevents caching an unauthenticated response', async () => {
    getAuthenticatedUserMock.mockResolvedValueOnce(null);

    const response = await GET(new Request('https://shop.example/api/account'));

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
