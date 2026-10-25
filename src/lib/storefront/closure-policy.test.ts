import { describe, expect, it } from 'vitest';
import { canAccessWhileStoreClosed, resolveStorefrontLocale } from './closure-policy';

describe('storefront closure route policy', () => {
  it.each([
    '/',
    '/es',
    '/products',
    '/es/products/hoodie',
    '/product/123',
    '/cart',
    '/favorites',
    '/about',
    '/es/sign-up',
  ])('blocks public storefront route %s', (pathname) => {
    expect(canAccessWhileStoreClosed(pathname)).toBe(false);
  });

  it.each([
    '/dashboard',
    '/es/dashboard',
    '/en/dashboard/plan/success',
    '/developer',
    '/es/sign-in',
    '/account',
    '/es/account',
    '/historial',
    '/en/historial',
    '/checkout',
    '/checkout/stripe',
    '/checkout/paypal',
    '/es/legal',
    '/contact',
    '/support',
    '/es/arrepentimiento',
  ])('keeps essential route %s available', (pathname) => {
    expect(canAccessWhileStoreClosed(pathname)).toBe(true);
  });

  it('resolves locale from route first and then the locale cookie', () => {
    expect(resolveStorefrontLocale('/en/products', 'NEXT_LOCALE=es')).toBe('en');
    expect(resolveStorefrontLocale('/products', 'x=y; NEXT_LOCALE=en')).toBe('en');
    expect(resolveStorefrontLocale('/', null)).toBe('en');
  });
});
