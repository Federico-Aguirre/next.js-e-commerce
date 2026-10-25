import { cleanup, render, screen } from '@testing-library/react';
import type { ImgHTMLAttributes, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', () => ({
  default: ({ src, alt }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt?: string }) => (
    <span role="img" aria-label={alt ?? ''} data-src={src} />
  ),
}));

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: ReactNode;
  } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { ProductCard } from './ProductCard';

afterEach(() => cleanup());

describe('ProductCard', () => {
  it('renders the shared product structure, price, category and canonical destinations', () => {
    render(
      <ProductCard
        title="Classic Jacket"
        href="/products/classic-jacket"
        imageSrc="/assets/images/products/classic-jacket.webp"
        category="Jackets"
        price={<span>ARS 42.000</span>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Classic Jacket' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Classic Jacket' })).toHaveAttribute(
      'data-src',
      '/assets/images/products/classic-jacket.webp',
    );
    expect(screen.getByText('Jackets')).toBeInTheDocument();
    expect(screen.getByText('ARS 42.000')).toBeInTheDocument();

    const productLinks = screen.getAllByRole('link', { name: 'Classic Jacket' });
    expect(productLinks).toHaveLength(2);
    expect(
      productLinks.every((link) => link.getAttribute('href') === '/products/classic-jacket'),
    ).toBe(true);
  });

  it('shows the shared unavailable badge when a product cannot be purchased', () => {
    render(
      <ProductCard
        title="Limited Shoes"
        href="/products/limited-shoes"
        imageSrc="/limited-shoes.webp"
        price={<span>ARS 15.000</span>}
        available={false}
        stockLabel="Sin stock"
      />,
    );

    expect(screen.getByText('Sin stock')).toBeInTheDocument();
  });

  it('keeps an optional action separate from the product link', () => {
    render(
      <ProductCard
        title="Basic Tee"
        href="/products/basic-tee"
        imageSrc="/basic-tee.webp"
        price={<span>ARS 8.000</span>}
        overlayAction={
          <button type="button" aria-label="Agregar a favoritos">
            ♡
          </button>
        }
      />,
    );

    expect(screen.getByRole('button', { name: 'Agregar a favoritos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic Tee' })).toBeInTheDocument();
  });
});
