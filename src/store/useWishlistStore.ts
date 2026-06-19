import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

interface WishlistState {
  wishlist: WishlistItem[];
  _hasHydrated: boolean; // 🌟 Nueva bandera de control
  setHasHydrated: (state: boolean) => void; // 🌟 Setter para la bandera
  toggleWishlist: (product: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],
      _hasHydrated: false, // Inicia en false

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      toggleWishlist: (product) => {
        const { wishlist } = get();
        const exists = wishlist.some((item) => item.id === product.id);

        if (exists) {
          set({ wishlist: wishlist.filter((item) => item.id !== product.id) });
        } else {
          set({ wishlist: [...wishlist, product] });
        }
      },

      isInWishlist: (productId) => {
        return get().wishlist.some((item) => item.id === productId);
      },

      clearWishlist: () => set({ wishlist: [] }),
    }),
    {
      name: 'wishlist-storage',
      // 🌟 Este callback nativo se ejecuta AUTOMÁTICAMENTE cuando el localStorage ya se cargó en memoria
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);