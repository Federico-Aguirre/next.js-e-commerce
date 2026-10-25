const ACCESSIBLE_WHILE_CLOSED: RegExp[] = [
  /^\/(?:en\/|es\/)?dashboard(?:\/|$)/,
  /^\/(?:en\/|es\/)?developer(?:\/|$)/,
  /^\/(?:en\/|es\/)?sign-in\/?$/,
  /^\/(?:en\/|es\/)?account(?:\/|$)/,
  /^\/(?:en\/|es\/)?historial(?:\/|$)/,
  // Keep an already-created payment flow available. The checkout API separately
  // rejects any attempt to create a new order after the store cutoff.
  /^\/checkout(?:\/|$)/,
  // Customers must retain access to consumer rights and ways to contact support.
  /^\/(?:en\/|es\/)?(?:legal|contact|support|arrepentimiento)(?:\/|$)/,
];

export function canAccessWhileStoreClosed(pathname: string): boolean {
  const path = (pathname.split('?')[0] || '/').replace(/\/{2,}/g, '/');
  return ACCESSIBLE_WHILE_CLOSED.some((pattern) => pattern.test(path));
}

export function resolveStorefrontLocale(
  pathname: string,
  cookieHeader: string | null,
): 'en' | 'es' {
  const pathLocale = /^\/(en|es)(?:\/|$)/.exec(pathname)?.[1];
  if (pathLocale === 'en' || pathLocale === 'es') return pathLocale;

  const cookieLocale = /(?:^|;\s*)NEXT_LOCALE=(en|es)(?:;|$)/.exec(cookieHeader ?? '')?.[1];
  return cookieLocale === 'en' || cookieLocale === 'es' ? cookieLocale : 'en';
}
