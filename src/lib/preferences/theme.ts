export type ThemePreference = 'light' | 'dark';

const THEME_COOKIE_NAME = 'nova_theme';
const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark';
}

export function parseThemeCookie(cookieHeader: string): ThemePreference | null {
  const pair = cookieHeader
    .split(';')
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(THEME_COOKIE_NAME + '='));

  if (!pair) return null;
  const value = pair.slice(THEME_COOKIE_NAME.length + 1);
  return isThemePreference(value) ? value : null;
}

export function serializeThemeCookie(theme: ThemePreference, secure: boolean): string {
  return [
    THEME_COOKIE_NAME + '=' + theme,
    'Path=/',
    'Max-Age=' + THEME_COOKIE_MAX_AGE_SECONDS,
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}
