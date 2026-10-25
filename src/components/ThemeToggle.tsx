'use client';

import { Moon, Sun } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  isThemePreference,
  parseThemeCookie,
  serializeThemeCookie,
  type ThemePreference,
} from '@/lib/preferences/theme';

function persistTheme(theme: ThemePreference) {
  localStorage.setItem('theme', theme);
  document.cookie = serializeThemeCookie(theme, window.location.protocol === 'https:');
  document.documentElement.classList.toggle('dark', theme === 'dark');
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle() {
  const pathname = usePathname();
  const isSpanish = pathname.startsWith('/es');
  const [theme, setTheme] = useState<ThemePreference>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const cookieTheme = parseThemeCookie(document.cookie);
    const localTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // The early theme script reads the cookie before paint. Keep browser storage
    // in sync with it; localStorage remains a migration fallback for existing visitors.
    const activeTheme =
      cookieTheme ??
      (isThemePreference(localTheme) ? localTheme : systemPrefersDark ? 'dark' : 'light');

    persistTheme(activeTheme);

    queueMicrotask(() => {
      setTheme(activeTheme);
      setMounted(true);
    });
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    persistTheme(nextTheme);
    setTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <div
        aria-hidden="true"
        className="size-10 rounded-md border border-border bg-card shadow-sm"
      />
    );
  }

  return (
    <Button
      onClick={toggleTheme}
      variant="outline"
      size="icon"
      className="cursor-pointer border-border bg-card text-foreground shadow-sm hover:bg-accent"
      aria-label={isSpanish ? 'Cambiar tema claro u oscuro' : 'Toggle light or dark theme'}
      aria-pressed={theme === 'dark'}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
