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
  _hasHydrated: boolean; 
  isInitialMergeDone: boolean; // 🌟 Nueva bandera global para controlar el login único
  setHasHydrated: (state: boolean) => void; 
  setInitialMergeDone: (done: boolean) => void; // 🌟 Setter para controlar el estado del merge
  toggleWishlist: (product: WishlistItem) => void;
  isInWishlist: (productId: string) => boolean;
  clearWishlist: () => void;
}

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      wishlist: [],
      _hasHydrated: false, 
      isInitialMergeDone: false, // 🌟 Inicia en false (vuelve a sincronizar solo al iniciar sesión)

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

      // 🌟 Al limpiar la wishlist por deslogueo, reseteamos la bandera 
      // para que el próximo usuario que se conecte sí tenga su merge inicial.
      clearWishlist: () => set({ wishlist: [], isInitialMergeDone: false }),
    }),
    {
      name: 'wishlist-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);