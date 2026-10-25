import { describe, expect, it } from 'vitest';
import { isThemePreference, parseThemeCookie, serializeThemeCookie } from './theme';

describe('theme preference cookie', () => {
  it('reads only supported theme values from a cookie header', () => {
    expect(parseThemeCookie('session=abc; nova_theme=dark; other=value')).toBe('dark');
    expect(parseThemeCookie('nova_theme=light')).toBe('light');
    expect(parseThemeCookie('nova_theme=system')).toBeNull();
    expect(parseThemeCookie('not_nova_theme=dark')).toBeNull();
    expect(parseThemeCookie('')).toBeNull();
  });

  it('serializes a one-year same-site preference cookie', () => {
    expect(serializeThemeCookie('dark', true)).toBe(
      'nova_theme=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure',
    );
    expect(serializeThemeCookie('light', false)).toBe(
      'nova_theme=light; Path=/; Max-Age=31536000; SameSite=Lax',
    );
  });

  it('accepts only light and dark as persisted values', () => {
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('auto')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });
});
