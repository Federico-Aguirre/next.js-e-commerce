// @vitest-environment node

import { encode, getToken } from 'next-auth/jwt';
import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

const secret = 'unit-test-nextauth-secret-that-is-long-enough-123';

async function makeToken() {
  return encode({
    token: {
      id: 'user-test-123',
      sub: 'user-test-123',
      email: 'buyer@example.test',
    },
    secret,
    maxAge: 60,
  });
}

describe('mobile bearer session compatibility', () => {
  it('decodes a signed NextAuth v4 bearer token', async () => {
    const token = await makeToken();
    const request = new NextRequest('https://store.example/api/orders', {
      headers: { Authorization: 'Bearer ' + encodeURIComponent(token) },
    });

    const payload = await getToken({
      req: request,
      secret,
      secureCookie: false,
    });

    expect(payload?.id).toBe('user-test-123');
    expect(payload?.sub).toBe('user-test-123');
  });

  it('decodes the same empty-salt token when stored in the NextAuth v4 session cookie', async () => {
    const token = await makeToken();
    const request = new NextRequest('http://store.example/api/orders', {
      headers: { Cookie: 'next-auth.session-token=' + encodeURIComponent(token) },
    });

    const payload = await getToken({
      req: request,
      secret,
      secureCookie: false,
    });

    expect(payload?.id).toBe('user-test-123');
  });

  it('does not decode a cookie token encoded with the cookie name as salt', async () => {
    const token = await encode({
      token: { id: 'user-test-123', sub: 'user-test-123' },
      secret,
      maxAge: 60,
      salt: 'next-auth.session-token',
    });
    const request = new NextRequest('http://store.example/api/orders', {
      headers: { Cookie: 'next-auth.session-token=' + encodeURIComponent(token) },
    });

    const payload = await getToken({
      req: request,
      secret,
      secureCookie: false,
    });

    expect(payload).toBeNull();
  });
});
