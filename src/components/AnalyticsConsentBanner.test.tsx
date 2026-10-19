import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/es',
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    className,
    children,
  }: {
    href: string;
    className?: string;
    children: ReactNode;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

import AnalyticsConsentBanner from './AnalyticsConsentBanner';

describe('AnalyticsConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it.each(['Aceptar analítica opcional', 'Rechazar analítica'])(
    'shows a pointer cursor on the "%s" button',
    async (label) => {
      render(<AnalyticsConsentBanner />);

      const button = await screen.findByRole('button', { name: label });

      expect(button).toHaveClass('cursor-pointer');
    },
  );
});
