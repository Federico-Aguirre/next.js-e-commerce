import { describe, expect, it } from 'vitest';
import { hasVerifiedPayPalConnection } from './paypal-connection-readiness';

describe('hasVerifiedPayPalConnection', () => {
  it('keeps an active connection usable when the live status endpoint is temporarily unavailable', () => {
    expect(
      hasVerifiedPayPalConnection({
        status: 'ACTIVE',
        externalAccountId: 'seller-test-id',
        metadata: { sandbox: true },
      }),
    ).toBe(true);
  });

  it('recovers a previously verified sandbox connection demoted by a failed status refresh', () => {
    expect(
      hasVerifiedPayPalConnection({
        status: 'REQUIRES_ACTION',
        externalAccountId: 'seller-test-id',
        metadata: {
          sandbox: true,
          verification: 'paypal_tracking_api',
          paymentsReceivable: true,
          primaryEmailConfirmed: true,
          thirdPartyConsent: true,
        },
      }),
    ).toBe(true);
  });

  it('does not bypass onboarding that never passed the required checks', () => {
    expect(
      hasVerifiedPayPalConnection({
        status: 'REQUIRES_ACTION',
        externalAccountId: 'seller-test-id',
        metadata: {
          sandbox: true,
          verification: 'paypal_tracking_api',
          paymentsReceivable: true,
          primaryEmailConfirmed: true,
          thirdPartyConsent: false,
        },
      }),
    ).toBe(false);
  });

  it('requires a linked seller account and never trusts non-sandbox verification metadata', () => {
    expect(
      hasVerifiedPayPalConnection({
        status: 'ACTIVE',
        externalAccountId: null,
        metadata: {},
      }),
    ).toBe(false);
    expect(
      hasVerifiedPayPalConnection({
        status: 'REQUIRES_ACTION',
        externalAccountId: 'seller-live-id',
        metadata: {
          sandbox: false,
          verification: 'paypal_api',
          paymentsReceivable: true,
          primaryEmailConfirmed: true,
          thirdPartyConsent: true,
        },
      }),
    ).toBe(false);
    expect(
      hasVerifiedPayPalConnection({
        status: 'ACTIVE',
        externalAccountId: 'seller-live-id',
        metadata: { sandbox: false },
      }),
    ).toBe(false);
  });
});
