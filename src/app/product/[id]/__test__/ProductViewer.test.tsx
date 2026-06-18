/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import ProductViewer from '../ProductViewer';
import { Product, ProductCartItem } from '@/types/product';

// 🛒 Mockeamos Zustand de forma segura sin usar 'any'
const mockAddToCart = vi.fn();
vi.mock('@/store/useCartStore', () => ({
  useCartStore: (selector: (state: { addToCart: (item: ProductCartItem) => void }) => unknown) => {
    return selector({ addToCart: mockAddToCart });
  },
}));

// 🌟 Mockeamos componentes secundarios aislados
vi.mock('@/components/WishlistButton', () => ({
  default: () => <div data-testid="wishlist-mock">Wishlist</div>,
}));

// 🖼️ Usamos la etiqueta img nativa silenciando la regla del linter para el entorno de pruebas
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img src={src} alt={alt} {...props} />
  ),
}));

describe('<ProductViewer /> - Unit Tests', () => {
  const mockProduct: Product = {
    id: 42,
    title: 'Zapatillas Alpha Run',
    price: 125.50,
    description: 'Calzado premium para alta performance.',
    category: 'Running',
    image: '/images/alpha-front.jpg',
    variants: [
      {
        articleId: 1001,
        colorName: 'Azul Eléctrico',
        sizes: ['39', '40', '42'],
        images: [{ id: 'img-1', url: '/images/alpha-blue.jpg' }]
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  test('Debería incrementar y decrementar la cantidad interactiva correctamente', () => {
    render(<ProductViewer product={mockProduct} />);

    const botonMas = screen.getByRole('button', { name: '+' });
    const botonMenos = screen.getByRole('button', { name: '−' });

    fireEvent.click(botonMas);
    expect(screen.getByText('2')).toBeInTheDocument();

    fireEvent.click(botonMenos);
    expect(screen.getByText('1')).toBeInTheDocument();

    fireEvent.click(botonMenos);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  test('Debería alertar al usuario si intenta añadir al carrito sin elegir un talle', () => {
    render(<ProductViewer product={mockProduct} />);

    const botonAñadir = screen.getByRole('button', { name: /añadir al carrito/i });

    fireEvent.click(botonAñadir);

    expect(window.alert).toHaveBeenCalledWith('Por favor, selecciona un talle antes de añadir al carrito.');
    expect(mockAddToCart).not.toHaveBeenCalled();
  });
});