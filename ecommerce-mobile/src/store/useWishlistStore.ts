import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface WishlistItem {
  id: string;
  title: string;
  price: number;
  image: string;
  category?: string;
}

interface WishlistState {
  wishlist: WishlistItem[];
  _hasHydrated: boolean;
  isInitialMergeDone: boolean;
  setHasHydrated: (state: boolean) => void;
  setInitialMergeDone: (done: boolean) => void;
  toggleWishlist: (product: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],
      _hasHydrated: false,
      isInitialMergeDone: false,

      setHasHydrated: (state) => set({ _hasHydrated: state }),

      setInitialMergeDone: (done) => set({ isInitialMergeDone: done }),

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

      clearWishlist: () => set({ wishlist: [], isInitialMergeDone: false }),
    }),
    {
      name: 'wishlist-storage',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);