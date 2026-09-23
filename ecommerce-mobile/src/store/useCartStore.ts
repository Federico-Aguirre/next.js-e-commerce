import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CartItem {
  id: number;
  articleId: number;
  title: string;
  price: number;
  colorName: string;
  size: string;
  image: string;
  quantity: number;
  category?: string;
}

interface CartState {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, stockMaximo?: number) => void;
  removeFromCart: (articleId: number, size: string) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotal: () => number;
  setCart: (items: CartItem[]) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (newItem, stockMaximo) => {
        const currentCart = get().cart;
        const existingIndex = currentCart.findIndex(
          (item) =>
            item.articleId === newItem.articleId && item.size === newItem.size,
        );

        const limiteStock = stockMaximo !== undefined ? stockMaximo : 99;

        if (existingIndex > -1) {
          const updatedCart = [...currentCart];
          const itemExistente = updatedCart[existingIndex];

          if (itemExistente.quantity >= limiteStock) {
            console.warn(
              `[STOCK LIMITADO]: No puedes agregar más de ${limiteStock} unidades.`,
            );
            return;
          }

          itemExistente.quantity += 1;
          set({ cart: updatedCart });
        } else {
          if (limiteStock <= 0) {
            console.warn(`[STOCK AGOTADO]: No queda stock disponible.`);
            return;
          }
          set({ cart: [...currentCart, { ...newItem, quantity: 1 }] });
        }
      },

      removeFromCart: (articleId, size) => {
        set({
          cart: get().cart.filter(
            (item) => !(item.articleId === articleId && item.size === size),
          ),
        });
      },

      clearCart: () => set({ cart: [] }),

      getCartCount: () =>
        get().cart.reduce((total, item) => total + item.quantity, 0),
      getCartTotal: () =>
        get().cart.reduce(
          (total, item) => total + item.price * item.quantity,
          0,
        ),
      setCart: (items) => set({ cart: items }),
    }),
    {
      name: 'nova-cart-storage-mobile',
      storage: createJSONStorage(() => AsyncStorage), // <--- Adaptado para persistencia en iOS/Android
    },
  ),
);
