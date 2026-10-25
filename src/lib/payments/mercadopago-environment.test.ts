import { describe, expect, it } from 'vitest';
import {
  isMercadoPagoSandboxOAuthMetadata,
  resolveMercadoPagoEnvironment,
  resolveMercadoPagoSandboxCredentials,
} from './mercadopago-environment';

describe('Mercado Pago environment selection', () => {
  it('defaults to sandbox when no environment is configured', () => {
    expect(resolveMercadoPagoEnvironment(undefined)).toBe('sandbox');
    expect(resolveMercadoPagoEnvironment('  ')).toBe('sandbox');
  });

  it('recognizes only explicit sandbox and production modes', () => {
    expect(resolveMercadoPagoEnvironment('sandbox')).toBe('sandbox');
    expect(resolveMercadoPagoEnvironment('PRODUCTION')).toBe('production');
    expect(resolveMercadoPagoEnvironment('live')).toBe('invalid');
  });

  it('trusts a stored OAuth token only when its metadata identifies sandbox', () => {
    expect(isMercadoPagoSandboxOAuthMetadata({ sandbox: true, liveMode: false })).toBe(true);
    expect(isMercadoPagoSandboxOAuthMetadata({ sandbox: true, liveMode: true })).toBe(false);
    expect(isMercadoPagoSandboxOAuthMetadata({ sandbox: false, liveMode: false })).toBe(false);
    expect(isMercadoPagoSandboxOAuthMetadata(null)).toBe(false);
  });

  it('enables marketplace split only for a sandbox OAuth token and developer credentials', () => {
    const result = resolveMercadoPagoSandboxCredentials({
      environment: 'sandbox',
      oauthAccessToken: 'oauth-test-token',
      oauthMetadata: { sandbox: true, liveMode: false },
      sandboxStandaloneAccessToken: 'standalone-test-token',
      developerClientId: 'developer-client-id',
      developerClientSecret: 'developer-client-secret',
    });

    expect(result).toEqual({
      accessToken: 'oauth-test-token',
      chargeEnabled: true,
      splitEnabled: true,
      standaloneEnabled: false,
      sandbox: true,
    });
  });

  it('blocks OAuth tokens without sandbox metadata instead of silently using them', () => {
    const result = resolveMercadoPagoSandboxCredentials({
      environment: 'sandbox',
      oauthAccessToken: 'unclassified-token',
      oauthMetadata: { sandbox: false },
      developerClientId: 'developer-client-id',
      developerClientSecret: 'developer-client-secret',
    });

    expect(result.accessToken).toBeUndefined();
    expect(result.chargeEnabled).toBe(false);
    expect(result.splitEnabled).toBe(false);
  });

  it('accepts standalone credentials only when they are supplied through sandbox-specific variables', () => {
    const result = resolveMercadoPagoSandboxCredentials({
      environment: 'sandbox',
      sandboxStandaloneAccessToken: 'standalone-test-token',
    });

    expect(result).toEqual({
      accessToken: 'standalone-test-token',
      chargeEnabled: true,
      splitEnabled: false,
      standaloneEnabled: true,
      sandbox: true,
    });
  });

  it('blocks all Mercado Pago charging in production or an invalid mode until live marketplace support is ready', () => {
    for (const environment of ['production', 'invalid', 'live']) {
      const result = resolveMercadoPagoSandboxCredentials({
        environment,
        oauthAccessToken: 'oauth-token',
        oauthMetadata: { sandbox: true, liveMode: false },
        sandboxStandaloneAccessToken: 'standalone-test-token',
        developerClientId: 'developer-client-id',
        developerClientSecret: 'developer-client-secret',
      });

      expect(result.accessToken).toBeUndefined();
      expect(result.chargeEnabled).toBe(false);
      expect(result.splitEnabled).toBe(false);
      expect(result.standaloneEnabled).toBe(false);
      expect(result.sandbox).toBe(false);
    }
  });

  it('does not mark an OAuth token chargeable when developer split credentials are missing', () => {
    const result = resolveMercadoPagoSandboxCredentials({
      environment: 'sandbox',
      oauthAccessToken: 'oauth-test-token',
      oauthMetadata: { sandbox: true, liveMode: false },
    });

    expect(result.accessToken).toBeUndefined();
    expect(result.chargeEnabled).toBe(false);
    expect(result.splitEnabled).toBe(false);
    expect(result.standaloneEnabled).toBe(false);
  });
});
