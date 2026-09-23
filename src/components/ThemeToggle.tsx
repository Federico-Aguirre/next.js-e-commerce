'use client';

import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Read local storage safely without unsafe type assertions
    const storedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)',
    ).matches;

    let activeTheme: 'light' | 'dark' = 'light';

    if (storedTheme === 'dark' || storedTheme === 'light') {
      activeTheme = storedTheme;
    } else if (systemPrefersDark) {
      activeTheme = 'dark';
    }

    document.documentElement.classList.toggle('dark', activeTheme === 'dark');
    document.documentElement.style.colorScheme = activeTheme;

    // Defer state update to avoid synchronous cascading re-renders in React Compiler
    queueMicrotask(() => {
      setTheme(activeTheme);
      setMounted(true);
    });
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    document.documentElement.style.colorScheme = nextTheme;
  };

  if (!mounted) {
    return <div className="size-9" />;
  }

  return (
    <Button
      onClick={toggleTheme}
      variant="outline"
      size="icon"
      className="cursor-pointer"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
