import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { JWT } from 'next-auth/jwt';
import { describe, expect, it, vi } from 'vitest';
import {
  refreshSessionTokenIdentity,
  resolveNextAuthSecret,
  SESSION_MAX_AGE_SECONDS,
  type CurrentSessionUser,
} from './session-security';

describe('NextAuth secret and session security', () => {
  it('requires a strong, unique secret in production', () => {
    expect(() => resolveNextAuthSecret(undefined, 'production')).toThrow(/NEXTAUTH_SECRET/);
    expect(() => resolveNextAuthSecret('too-short', 'production')).toThrow(/NEXTAUTH_SECRET/);
    expect(() => resolveNextAuthSecret('x'.repeat(48), 'production')).toThrow(/NEXTAUTH_SECRET/);
    expect(() =>
      resolveNextAuthSecret('clave_secreta_para_encriptar_cookies', 'production'),
    ).toThrow(/NEXTAUTH_SECRET/);
    const strongSecret = 'A7c9Df2G5hJ8kL0mN3pQ6rS9tU1vW4xZ';
    expect(resolveNextAuthSecret(strongSecret, 'production')).toBe(strongSecret);
  });

  it('does not provide a predictable fallback in development', () => {
    expect(resolveNextAuthSecret(undefined, 'development')).toBeUndefined();
  });

  it('limits a JWT-backed session to seven days', () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it('refreshes admin privileges and identity from the database', async () => {
    const token: JWT = {
      id: 'user-1',
      email: 'old@example.test',
      name: 'Old name',
      isAdmin: true,
      isPlatformOwner: true,
    };
    const currentUser: CurrentSessionUser = {
      id: 'user-1',
      email: 'new@example.test',
      name: 'New name',
      isAdmin: false,
      isPlatformOwner: false,
    };
    const findUser = vi.fn().mockResolvedValue(currentUser);

    const refreshed = await refreshSessionTokenIdentity(token, findUser);

    expect(findUser).toHaveBeenCalledWith({ id: 'user-1' });
    expect(refreshed.email).toBe('new@example.test');
    expect(refreshed.name).toBe('New name');
    expect(refreshed.isAdmin).toBe(false);
    expect(refreshed.isPlatformOwner).toBe(false);
  });

  it('clears session identity when the user no longer exists', async () => {
    const token: JWT = {
      id: 'deleted-user',
      email: 'deleted@example.test',
      name: 'Deleted user',
      sub: 'deleted-user',
      isAdmin: true,
      isPlatformOwner: true,
    };

    const refreshed = await refreshSessionTokenIdentity(token, vi.fn().mockResolvedValue(null));

    expect(refreshed.id).toBeUndefined();
    expect(refreshed.email).toBeUndefined();
    expect(refreshed.name).toBeUndefined();
    expect(refreshed.sub).toBeUndefined();
    expect(refreshed.isAdmin).toBe(false);
    expect(refreshed.isPlatformOwner).toBe(false);
  });

  it('prevents reintroducing public database credentials in app config', () => {
    const root = process.cwd();
    const nextConfig = readFileSync(resolve(root, 'next.config.ts'), 'utf8');
    const envExample = readFileSync(resolve(root, '.env.example'), 'utf8');
    const prismaSource = readFileSync(resolve(root, 'src/lib/prisma.ts'), 'utf8');
    const authOptionsSource = readFileSync(resolve(root, 'src/lib/auth-options.ts'), 'utf8');

    expect(nextConfig).not.toMatch(/\benv\s*:\s*\{/);
    expect(envExample).not.toMatch(/^\s*NEXT_PUBLIC_DATABASE_URL\s*=/m);
    expect(prismaSource).toMatch(/^import ['"]server-only['"];$/m);
    expect(authOptionsSource).toMatch(/^import ['"]server-only['"];$/m);

    for (const file of ['.env', '.env.local', '.env.development.local', '.env.production']) {
      const fullPath = resolve(root, file);
      if (existsSync(fullPath)) {
        const localEnvironment = readFileSync(fullPath, 'utf8');
        expect(localEnvironment).not.toMatch(/^\s*NEXT_PUBLIC_DATABASE_URL\s*=/m);
      }
    }
  });
});
