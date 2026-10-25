'use client';

import { usePathname } from 'next/navigation';

export function SkipLink() {
  const pathname = usePathname();
  const label = pathname.startsWith('/es')
    ? 'Saltar al contenido principal'
    : 'Skip to main content';

  return (
    <a
      href="#main-content"
      className="sr-only fixed top-3 left-3 z-[200] rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground shadow-lg focus:not-sr-only focus:outline-2 focus:outline-offset-4 focus:outline-foreground"
    >
      {label}
    </a>
  );
}
