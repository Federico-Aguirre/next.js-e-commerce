import { createSchema, createYoga } from 'graphql-yoga';
import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/request-user';
import { getPublicCatalogProduct, getPublicCatalogProducts } from '@/lib/catalog/public-catalog';
import { prisma } from '@/lib/prisma';
import { prismaWithRetry } from '@/lib/prisma-retry';
import {
  checkRateLimit,
  getRequestClientIp,
  hashRateLimitIdentity,
} from '@/lib/security/rate-limit';

type GraphQLContext = {
  authenticatedUser: Awaited<ReturnType<typeof getAuthenticatedUser>>;
};

function requireAuthenticatedUser(context: GraphQLContext) {
  const user = context.authenticatedUser;
  if (!user) throw new Error('No autenticado.');
  return user;
}

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
    articleId: Int!
    rootProductId: Int
    variantId: String
    colorName: String
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
    syncWishlist(userId: String!, productIds: [Int!]!, isInitial: Boolean): [Product!]!
  }
`;

const resolvers = {
  CartItem: {
    articleId: (item: { productId: number }) => Number(item.productId),
    rootProductId: async (item: { productId: number }) => {
      const sku = await prisma.productSku.findUnique({
        where: { articleId: Number(item.productId) },
        select: { variant: { select: { productId: true } } },
      });
      return sku?.variant.productId ?? null;
    },
    variantId: async (item: { productId: number }) => {
      const sku = await prisma.productSku.findUnique({
        where: { articleId: Number(item.productId) },
        select: { variantId: true },
      });
      return sku?.variantId ?? null;
    },
    colorName: async (item: { productId: number }) => {
      const sku = await prisma.productSku.findUnique({
        where: { articleId: Number(item.productId) },
        select: { variant: { select: { colorName: true } } },
      });
      return sku?.variant.colorName ?? null;
    },
  },
  Query: {
    products: async (_root: unknown, args: { category?: string }) => {
      try {
        return await prismaWithRetry(() => getPublicCatalogProducts({ category: args.category }));
      } catch (err) {
        console.error('[GraphQL Query Error - products]:', err);
        return [];
      }
    },

    product: async (_root: unknown, args: { id: number }) => {
      try {
        return await prismaWithRetry(() => getPublicCatalogProduct(args.id));
      } catch (err) {
        console.error('[GraphQL Query Error - product]:', err);
        return null;
      }
    },

    getDbCart: async (_root: unknown, _args: { userId: string }, context: GraphQLContext) => {
      try {
        const userId = requireAuthenticatedUser(context).id;
        return await prismaWithRetry(() => prisma.cartItem.findMany({ where: { userId } }));
      } catch (err) {
        console.error('[GraphQL Query Error - getDbCart]:', err);
        return [];
      }
    },
  },

  Mutation: {
    mergeCart: async (
      _root: unknown,
      args: { userId: string; localCart: any[]; isInitial?: boolean },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuthenticatedUser(context).id;
        const { localCart, isInitial = false } = args;
        if (!Array.isArray(localCart) || localCart.length > 100) {
          throw new Error('Carrito inválido.');
        }
        if (
          localCart.some(
            (item) =>
              !Number.isSafeInteger(Number(item.quantity)) ||
              Number(item.quantity) < 1 ||
              Number(item.quantity) > 99 ||
              !Number.isSafeInteger(Number(item.productId)) ||
              Number(item.productId) < 1 ||
              !String(item.size || '').trim() ||
              String(item.size).length > 32,
          )
        ) {
          throw new Error('Hay productos con cantidades o variantes inválidas.');
        }

        return await prismaWithRetry(async () => {
          if (isInitial) {
            const dbItems = await prisma.cartItem.findMany({
              where: { userId },
            });
            const map = new Map();

            dbItems.forEach((i: any) => map.set(`${i.productId}-${i.size}`, i));
            localCart.forEach((i: any) => {
              const key = `${i.productId}-${i.size}`;
              const existing = map.get(key);
              if (existing) existing.quantity += i.quantity;
              else map.set(key, { ...i, userId });
            });

            await prisma.cartItem.deleteMany({ where: { userId } });
            await prisma.cartItem.createMany({
              data: Array.from(map.values()).map((i: any) => ({
                userId,
                productId: Number(i.productId), // 👈 Cambiado de String a Number
                title: i.title,
                price: Number(i.price),
                image: i.image,
                size: i.size || 'UNICO',
                quantity: Number(i.quantity),
              })),
            });
          } else {
            await prisma.cartItem.deleteMany({ where: { userId } });
            if (localCart.length > 0) {
              await prisma.cartItem.createMany({
                data: localCart.map((i: any) => ({
                  userId,
                  productId: Number(i.productId), // 👈 Cambiado de String a Number
                  title: i.title,
                  price: Number(i.price),
                  image: i.image,
                  size: i.size || 'UNICO',
                  quantity: Number(i.quantity),
                })),
              });
            }
          }

          return await prisma.cartItem.findMany({ where: { userId } });
        });
      } catch (err) {
        console.error('Error en mergeCart:', err);
        throw new Error('Error al sincronizar el carrito');
      }
    },

    syncWishlist: async (
      _root: unknown,
      args: { userId: string; productIds: number[]; isInitial?: boolean },
      context: GraphQLContext,
    ) => {
      try {
        const userId = requireAuthenticatedUser(context).id;
        const { productIds, isInitial = false } = args;
        if (
          !Array.isArray(productIds) ||
          productIds.length > 200 ||
          productIds.some((id) => !Number.isSafeInteger(id) || id < 1)
        ) {
          throw new Error('Lista de favoritos inválida.');
        }

        return await prismaWithRetry(async () => {
          const db =
            (prisma as any).wishlistItem ||
            (prisma as any).wishlist ||
            (prisma as any).wishListItem;
          if (!db) return [];

          if (!isInitial) {
            await db.deleteMany({ where: { userId: String(userId) } });

            if (productIds && productIds.length > 0) {
              await db.createMany({
                data: productIds.map((pId) => ({
                  userId: String(userId),
                  productId: Number(pId),
                })),
              });
            }
          }

          const updatedItems = await db.findMany({
            where: { userId: String(userId) },
            select: { productId: true },
          });

          const finalIds = updatedItems.map((item: any) => item.productId);

          if (finalIds.length === 0) return [];

          return await prisma.product.findMany({
            where: { id: { in: finalIds } },
            include: {
              variants: {
                include: {
                  images: true,
                  skus: true,
                },
              },
            },
          });
        });
      } catch (err: any) {
        console.error('Error en wishlist:', err.message);
        throw new Error('Error interno en favoritos.');
      }
    },
  },
};

const schema = createSchema({ typeDefs, resolvers });

const yoga = createYoga({
  schema,
  graphqlEndpoint: '/api/graphql',
  // CORS is enforced by src/proxy.ts using the explicit environment allowlist.
  cors: false,
  context: async ({ request }) => ({
    authenticatedUser: await getAuthenticatedUser(request),
  }),
  fetchAPI: { Response },
});

async function handleGraphQLRequest(request: Request) {
  // Public catalog fields remain open; cart/favorites resolvers require this verified identity.
  // Keep HTTP responses uncacheable; only safe product metadata is cached in the data layer.
  const rateLimit = checkRateLimit(
    'graphql:' + hashRateLimitIdentity(getRequestClientIp(request)),
    { limit: 120, windowMs: 60_000 },
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiadas solicitudes. Volvé a intentar en un minuto.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'Cache-Control': 'private, no-store, max-age=0',
        },
      },
    );
  }
  const response = await yoga.handleRequest(request, {});
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function GET(request: Request) {
  return handleGraphQLRequest(request);
}

export async function POST(request: Request) {
  return handleGraphQLRequest(request);
}

export async function OPTIONS(request: Request) {
  return handleGraphQLRequest(request);
}
