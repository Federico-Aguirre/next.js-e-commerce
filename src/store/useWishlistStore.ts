import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Definimos la estructura del producto que guardaremos en favoritos
interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

interface WishlistState {
  wishlist: WishlistItem[];
  toggleWishlist: (product: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],

      // Agrega o quita el producto con un solo botón (Toggle)
      toggleWishlist: (product) => {
        const { wishlist } = get();
        const exists = wishlist.some((item) => item.id === product.id);

        if (exists) {
          // Si ya existe, lo filtramos para eliminarlo
          set({ wishlist: wishlist.filter((item) => item.id !== product.id) });
        } else {
          // Si no existe, lo agregamos a la lista
          set({ wishlist: [...wishlist, product] });
        }
      },

      // Función rápida para saber si un corazón debe pintarse de rojo o no
      isInWishlist: (productId) => {
        return get().wishlist.some((item) => item.id === productId);
      },

      clearWishlist: () => set({ wishlist: [] }),
    }),
    {
      name: 'wishlist-storage', // Nombre de la cookie en el localStorage
    }
  )
);