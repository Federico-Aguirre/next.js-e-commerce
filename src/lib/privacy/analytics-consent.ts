export type AnalyticsConsent = 'pending' | 'accepted' | 'rejected';

export const ANALYTICS_CONSENT_KEY = 'nova_analytics_consent';
export const ANALYTICS_CONSENT_EVENT = 'nova-analytics-consent-change';

export function readAnalyticsConsent(): AnalyticsConsent {
  if (typeof window === 'undefined') return 'pending';
  const stored = window.localStorage.getItem(ANALYTICS_CONSENT_KEY);
  return stored === 'accepted' || stored === 'rejected' ? stored : 'pending';
}

export function writeAnalyticsConsent(consent: AnalyticsConsent) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ANALYTICS_CONSENT_KEY, consent);
  window.dispatchEvent(new CustomEvent(ANALYTICS_CONSENT_EVENT, { detail: consent }));
}
