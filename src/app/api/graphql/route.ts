import { createSchema, createYoga } from 'graphql-yoga';
import { productsData } from '@/data/products';
import { prisma } from '@/lib/prisma';

const typeDefs = `
  type ProductImage {
    id: ID!
    url: String!
  }

  type ProductVariant {
    articleId: Int!
    colorName: String!
    sizes: [String!]!
    images: [ProductImage!]!
  }

  type Product {
    id: Int!
    title: String!
    price: Float!
    description: String!
    category: String!
    image: String!
    variants: [ProductVariant!]!
  }

  type CartItem {
    id: String!
    productId: Int!
    title: String!
    price: Float!
    quantity: Int!
    image: String!
    size: String!
  }

  input LocalCartItemInput {
    id: Int!
    productId: Int!
    title: String!
    price: Float!
    size: String!
    image: String!
    quantity: Int!
  }

  type Query {
    products(category: String): [Product!]!
    product(id: Int!): Product
    getDbCart(userId: String!): [CartItem!]!
  }

  type Mutation {
    mergeCart(userId: String!, localCart: [LocalCartItemInput!]!, isInitial: Boolean): [CartItem!]!
    syncWishlist(userId: String!, productIds: [Int!]!): [Product!]! # 🌟 CORREGIDO: Cambiado de [Int!]! a [Product!]!
  }
`;

const resolvers = {
  Query: {
    products: (_root: unknown, args: { category?: string }) => {
      if (args.category) {
        return productsData.filter((product) => product.category.toLowerCase() === args.category?.toLowerCase());
      }
      return productsData;
    },
    product: (_root: unknown, args: { id: number }) => {
      return productsData.find((product) => product.id === args.id) || null;
    },
    getDbCart: async (_root: unknown, args: { userId: string }) => {
      return await prisma.cartItem.findMany({ where: { userId: args.userId } });
    }
  },

  Mutation: {
    mergeCart: async (_root: unknown, args: { userId: string; localCart: any[]; isInitial?: boolean }) => {
      try {
        const { userId, localCart, isInitial = false } = args;
        if (!userId) throw new Error("userId requerido");

        if (isInitial) {
          const dbItems = await prisma.cartItem.findMany({ where: { userId } });
          const map = new Map();
          
          dbItems.forEach(i => map.set(`${i.productId}-${i.size}`, i));
          localCart.forEach(i => {
            const key = `${i.productId}-${i.size}`;
            const existing = map.get(key);
            if (existing) existing.quantity += i.quantity;
            else map.set(key, { ...i, userId });
          });
          
          await prisma.cartItem.deleteMany({ where: { userId } });
          await prisma.cartItem.createMany({ data: Array.from(map.values()).map(i => ({
            userId, productId: i.productId, title: i.title, price: i.price, image: i.image, size: i.size, quantity: i.quantity
          }))});
        } 
        else {
          await prisma.cartItem.deleteMany({ where: { userId } });
          if (localCart.length > 0) {
            await prisma.cartItem.createMany({ data: localCart.map(i => ({
                userId, productId: i.productId, title: i.title, price: i.price, image: i.image, size: i.size, quantity: i.quantity
            }))});
          }
        }

        return await prisma.cartItem.findMany({ where: { userId } });
      } catch (err) {
        console.error(err);
        throw new Error("Error al sincronizar");
      }
    },

    syncWishlist: async (_root: unknown, args: any) => {
      try {
        const userId = args?.userId;
        const productIds = args?.productIds;

        if (!userId) {
          console.error("❌ [BACKEND WISHLIST] Error: userId es nulo.");
          throw new Error("userId requerido");
        }

        console.log(`\n📥 [BACKEND WISHLIST] ID procesando: ${userId}`);

        const db = (prisma as any).wishlistItem || (prisma as any).wishlist || (prisma as any).wishListItem;

        if (!db) {
          console.error("❌ [PRISMA CONFIG] El modelo de tu Wishlist no se encuentra en el objeto prisma. Revisá tu schema.prisma");
          return [];
        }

        try {
          let finalProductIds: number[] = [];

          // MODO A: LOGIN / CARGA INICIAL
          if (!productIds || productIds.length === 0) {
            const existingItems = await db.findMany({
              where: { userId: String(userId) },
              select: { productId: true }
            });
            finalProductIds = existingItems.map((item: any) => item.productId);
          } 
          // MODO B: GUARDADO EN CALIENTE
          else {
            await db.deleteMany({
              where: { userId: String(userId) }
            });

            if (productIds.length > 0) {
              const dataToInsert = productIds.map((pId: number) => ({
                userId: String(userId),
                productId: Number(pId)
              }));
              
              await db.createMany({
                data: dataToInsert
              });
            }

            const updatedItems = await db.findMany({
              where: { userId: String(userId) },
              select: { productId: true }
            });

            finalProductIds = updatedItems.map((item: any) => item.productId);
          }
          
          // 🌟 CORREGIDO: Mapeamos los IDs numéricos recolectados a objetos del catálogo real 'productsData'
          return finalProductIds
            .map(id => productsData.find((product) => product.id === id))
            .filter(Boolean);

        } catch (dbError: any) {
          console.error("⚠️ [PRISMA DETECTED ERROR] Falló la operación en la tabla:", dbError.message);
          return [];
        }

      } catch (err: any) {
        console.error("🚨 [CRÍTICO YOGA]:", err.message);
        throw new Error("Error interno.");
      }
    }
  }
};

const schema = createSchema({ typeDefs, resolvers });

// Forzamos a Next.js a no cachear la ruta bajo ningún concepto
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { handleRequest } = createYoga({ schema, graphqlEndpoint: '/api/graphql' });
  return handleRequest(request, {});
}

export async function POST(request: Request) {
  const { handleRequest } = createYoga({ schema, graphqlEndpoint: '/api/graphql' });
  return handleRequest(request, {});
}