import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Tipado estricto del elemento del carrito (Actualizado con category opcional)
export interface CartItem {
  id: number;          // ID del producto raíz
  articleId: number;   // ID específico de la variante de color
  title: string;
  price: number;
  colorName: string;
  size: string;
  image: string;
  quantity: number;    // Cantidad de unidades
  category?: string;   // Opcional para que no rompa nada de lo existente
}

interface CartState {
  cart: CartItem[];
  // 🌟 AGREGADO: stockMaximo ahora es un segundo parámetro opcional
  addToCart: (item: Omit<CartItem, 'quantity'>, stockMaximo?: number) => void;
  removeFromCart: (articleId: number, size: string) => void;
  clearCart: () => void;
  getCartCount: () => number;
  getCartTotal: () => number;
  setCart: (items: CartItem[]) => void; // Acción crítica para inyectar el carrito tras el merge
}

// Creamos la store global con persistencia automática en LocalStorage
export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: [],

      addToCart: (newItem, stockMaximo) => {
        const currentCart = get().cart;
        
        // Buscamos si ya existe exactamente el mismo artículo con el mismo talle
        const existingIndex = currentCart.findIndex(
          (item) => item.articleId === newItem.articleId && item.size === newItem.size
        );

        // Si nos pasan un stockMaximo, lo usamos como techo. Si no viene, permitimos hasta 99 por las dudas.
        const limiteStock = stockMaximo !== undefined ? stockMaximo : 99;

        if (existingIndex > -1) {
          const updatedCart = [...currentCart];
          const itemExistente = updatedCart[existingIndex];

          // 🛡️ CONTROL DE INVENTARIO: Si ya llegó al límite de la base de datos, frenamos acá
          if (itemExistente.quantity >= limiteStock) {
            console.warn(`[STOCK LIMITADO]: No puedes agregar más de ${limiteStock} unidades de este talle.`);
            return; // Retorna sin actualizar el estado, bloqueando el clic
          }

          // Si pasó el filtro, sumamos 1 de forma inmutable
          itemExistente.quantity += 1;
          set({ cart: updatedCart });
        } else {
          // Si es nuevo, primero verificamos que haya stock mínimo para agregar la primera unidad
          if (limiteStock <= 0) {
            console.warn(`[STOCK AGOTADO]: No queda stock disponible para este producto.`);
            return;
          }
          
          // Si hay stock, lo agregamos al array con cantidad inicial de 1
          set({ cart: [...currentCart, { ...newItem, quantity: 1 }] });
        }
      },

      removeFromCart: (articleId, size) => {
        set({
          cart: get().cart.filter(
            (item) => !(item.articleId === articleId && item.size === size)
          ),
        });
      },

      clearCart: () => set({ cart: [] }),

      // Selectores dinámicos optimizados basados en el estado actual
      getCartCount: () => get().cart.reduce((total, item) => total + item.quantity, 0),
      getCartTotal: () => get().cart.reduce((total, item) => total + (item.price * item.quantity), 0),
      
      setCart: (items) => set({ cart: items }), // Setea el estado global de forma reactiva
    }),
    {
      name: 'senior-cart-storage', // Nombre de la llave dentro de LocalStorage
    }
  )
);