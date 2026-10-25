import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => {
  const params = new URLSearchParams();
  return {
    usePathname: () => '/es',
    useRouter: () => ({
      replace: vi.fn(),
      push: vi.fn(),
      refresh: vi.fn(),
    }),
    useSearchParams: () => params,
  };
});

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
    onClick,
    title,
    prefetch: _prefetch,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: ReactNode;
    prefetch?: boolean;
  }) => (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
      title={title}
      {...props}
    >
      {children}
    </a>
  ),
}));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
  signOut: vi.fn(),
}));

vi.mock('@/components/LocaleSwitcher', () => ({
  LocaleSwitcher: () => (
    <select aria-label="Cambiar idioma">
      <option>ES</option>
    </select>
  ),
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => (
    <button type="button" aria-label="Cambiar tema">
      Tema
    </button>
  ),
}));

vi.mock('@/store/useCartStore', () => ({
  useCartStore: (selector: (state: { getCartCount: () => number }) => unknown) =>
    selector({ getCartCount: () => 0 }),
}));

import { Header } from './Header';

async function renderHeader() {
  await act(async () => {
    render(<Header />);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  });
}

describe('Header responsive navigation', () => {
  afterEach(() => {
    cleanup();
  });

  it('opens an accessible mobile panel with search and all public navigation links', async () => {
    await renderHeader();

    const openButton = screen.getByRole('button', { name: 'Abrir menú' });
    expect(openButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(openButton);

    const closeButton = screen.getByRole('button', { name: 'Cerrar menú' });
    expect(closeButton).toHaveAttribute('aria-expanded', 'true');

    const panel = document.getElementById('mobile-navigation');
    expect(panel).not.toBeNull();
    expect(panel).not.toHaveClass('hidden');

    const mobile = within(panel as HTMLElement);
    expect(mobile.getByRole('textbox', { name: 'Buscar productos' })).toBeInTheDocument();
    expect(mobile.getByRole('link', { name: 'Inicio' })).toHaveAttribute('href', '/es');
    expect(mobile.getByRole('link', { name: 'Catálogo' })).toHaveAttribute('href', '/es/products');
    expect(mobile.getByRole('link', { name: 'Historial' })).toHaveAttribute(
      'href',
      '/es/historial',
    );
    expect(mobile.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/es/sign-in',
    );
  });

  it('closes the mobile panel when Escape is pressed', async () => {
    await renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(document.getElementById('mobile-navigation')).toHaveClass('hidden');
  });

  it('closes the mobile panel after selecting a navigation link', async () => {
    await renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir menú' }));

    fireEvent.click(
      within(document.getElementById('mobile-navigation') as HTMLElement).getByRole('link', {
        name: 'Catálogo',
      }),
    );

    expect(screen.getByRole('button', { name: 'Abrir menú' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
