import { beforeEach, describe, expect, it } from 'vitest';
import { useCartStore, type CartItem } from './useCartStore';

const regularCartItem: CartItem = {
  id: 10,
  productId: 10,
  articleId: 100,
  title: 'Producto del carrito',
  price: 1200,
  colorName: 'Negro',
  size: 'Único',
  image: '/producto-carrito.png',
  quantity: 2,
};

const buyNowItem: Omit<CartItem, 'quantity'> = {
  id: 20,
  productId: 20,
  articleId: 200,
  title: 'Compra directa',
  price: 3500,
  colorName: 'Azul',
  size: 'M',
  image: '/compra-directa.png',
};

beforeEach(() => {
  localStorage.removeItem('nova-cart-storage');
  useCartStore.setState({ cart: [], isBuyNow: false, buyNowBackup: null });
});

describe('useCartStore Buy Now flow', () => {
  it('checks out only the selected item and keeps the regular cart as a backup', () => {
    useCartStore.setState({ cart: [regularCartItem] });

    const started = useCartStore.getState().beginBuyNow(buyNowItem, 3, 5);

    expect(started).toBe(true);
    expect(useCartStore.getState().cart).toEqual([{ ...buyNowItem, quantity: 3 }]);
    expect(useCartStore.getState().isBuyNow).toBe(true);
    expect(useCartStore.getState().buyNowBackup).toEqual([regularCartItem]);
  });

  it('restores the regular cart after a successful direct checkout', () => {
    useCartStore.setState({ cart: [regularCartItem] });
    useCartStore.getState().beginBuyNow(buyNowItem, 1, 2);

    useCartStore.getState().finishCheckout();

    expect(useCartStore.getState().cart).toEqual([regularCartItem]);
    expect(useCartStore.getState().isBuyNow).toBe(false);
    expect(useCartStore.getState().buyNowBackup).toBeNull();
  });

  it('restores the regular cart when the direct checkout is cancelled', () => {
    useCartStore.setState({ cart: [regularCartItem] });
    useCartStore.getState().beginBuyNow(buyNowItem, 1, 2);

    useCartStore.getState().cancelBuyNow();

    expect(useCartStore.getState().cart).toEqual([regularCartItem]);
    expect(useCartStore.getState().isBuyNow).toBe(false);
    expect(useCartStore.getState().buyNowBackup).toBeNull();
  });

  it('limits the requested quantity to stock and refuses an out-of-stock item', () => {
    const started = useCartStore.getState().beginBuyNow(buyNowItem, 8, 2);

    expect(started).toBe(true);
    expect(useCartStore.getState().cart[0]?.quantity).toBe(2);

    useCartStore.getState().cancelBuyNow();
    expect(useCartStore.getState().beginBuyNow(buyNowItem, 1, 0)).toBe(false);
    expect(useCartStore.getState().cart).toEqual([]);
    expect(useCartStore.getState().isBuyNow).toBe(false);
  });

  it('preserves the existing clear-cart behavior for normal checkout', () => {
    useCartStore.setState({ cart: [regularCartItem] });

    useCartStore.getState().finishCheckout();

    expect(useCartStore.getState().cart).toEqual([]);
    expect(useCartStore.getState().isBuyNow).toBe(false);
  });
});
