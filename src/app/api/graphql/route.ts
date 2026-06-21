import { createSchema, createYoga } from 'graphql-yoga';
import { prisma } from '@/lib/prisma';
import { processSecureCheckout } from '@/services/checkout';

const typeDefs = `
  type VariantImage {
    id: ID!
    url: String!
  }

  type ProductSku {
    id: ID!
    articleId: Int!
    size: String!
    stock: Int!
  }

  type ProductVariant {
    id: ID!
    colorName: String!
    images: [VariantImage!]!
    skus: [ProductSku!]!
  }

  type Product {
    id: Int!
    name: String!
    price: Float!
    description: String!
    category: String!
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

  input CheckoutItemInput {
    productId: String!
    title: String!
    price: Float!
    quantity: Int!
    image: String!
  }

  type CheckoutResult {
    success: Boolean!
    orderId: String
  }

  type Query {
    products(category: String): [Product!]!
    product(id: Int!): Product
    getDbCart(userId: String!): [CartItem!]!
  }

  type Mutation {
    mergeCart(userId: String!, localCart: [LocalCartItemInput!]!, isInitial: Boolean): [CartItem!]!
    # 🚀 ACTUALIZADO: Agregamos el argumento opcional isInitial para diferenciar la carga inicial del borrado en caliente
    syncWishlist(userId: String!, productIds: [Int!]!, isInitial: Boolean): [Product!]!
    checkout(userId: String!, items: [CheckoutItemInput!]!): CheckoutResult!
  }
`;

const resolvers = {
  Query: {
    products: async (_root: unknown, args: { category?: string }) => {
      return await prisma.product.findMany({
        where: args.category 
          ? { category: { equals: args.category, mode: 'insensitive' } }
          : undefined,
        include: {
          variants: {
            include: {
              images: true,
              skus: { orderBy: { size: 'asc' } }
            }
          }
        }
      });
    },

    product: async (_root: unknown, args: { id: number }) => {
      return await prisma.product.findUnique({
        where: { id: args.id },
        include: {
          variants: {
            include: {
              images: true,
              skus: { orderBy: { size: 'asc' } }
            }
          }
        }
      });
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

    // 🌐 Sincronizar favoritos trayendo la info real de la base de datos relacional
    syncWishlist: async (_root: unknown, args: { userId: string; productIds: number[]; isInitial?: boolean }) => {
      try {
        const { userId, productIds, isInitial = false } = args;
        if (!userId) throw new Error("userId requerido");

        const db = (prisma as any).wishlistItem || (prisma as any).wishlist || (prisma as any).wishListItem;
        if (!db) return [];

        // 🚀 CORREGIDO PROFESIONALMENTE:
        // Solo operamos si NO es la consulta inicial de login.
        // Si no es el login, limpiamos Postgres por completo sin importar si viene un array vacío ([]).
        if (!isInitial) {
          console.log(`🧹 [BACKEND WISHLIST] Reemplazando favoritos para usuario ${userId}. Nuevos IDs:`, productIds);
          
          await db.deleteMany({ where: { userId: String(userId) } });
          
          if (productIds && productIds.length > 0) {
            await db.createMany({
              data: productIds.map(pId => ({ 
                userId: String(userId), 
                productId: Number(pId) 
              }))
            });
          }
        } else {
          console.log(`📥 [BACKEND WISHLIST] Carga inicial detectada para usuario ${userId}. Conservando estado actual.`);
        }

        // Buscamos lo que quedó guardado de manera definitiva
        const updatedItems = await db.findMany({
          where: { userId: String(userId) },
          select: { productId: true }
        });

        const finalIds = updatedItems.map((item: any) => item.productId);

        if (finalIds.length === 0) return [];

        return await prisma.product.findMany({
          where: { id: { in: finalIds } },
          include: {
            variants: {
              include: {
                images: true,
                skus: true
              }
            }
          }
        });

      } catch (err: any) {
        console.error("🚨 [ERROR WISHLIST]:", err.message);
        throw new Error("Error interno en favoritos.");
      }
    },

    checkout: async (_root: unknown, args: { userId: string; items: any[] }) => {
      try {
        const result = await processSecureCheckout(args.userId, args.items);
        return result; 
      } catch (err: any) {
        throw new Error(err.message);
      }
    }
  }
};

const schema = createSchema({ typeDefs, resolvers });

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { handleRequest } = createYoga({ schema, graphqlEndpoint: '/api/graphql' });
  return handleRequest(request, {});
}

export async function POST(request: Request) {
  const { handleRequest } = createYoga({ schema, graphqlEndpoint: '/api/graphql' });
  return handleRequest(request, {});
}