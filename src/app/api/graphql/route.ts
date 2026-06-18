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

      // 1. SI ES FUSIÓN: Traemos lo que hay en DB y sumamos lo nuevo
      if (isInitial) {
        const dbItems = await prisma.cartItem.findMany({ where: { userId } });
        const map = new Map();
        
        // Cargar DB
        dbItems.forEach(i => map.set(`${i.productId}-${i.size}`, i));
        // Sumar local
        localCart.forEach(i => {
          const key = `${i.productId}-${i.size}`;
          const existing = map.get(key);
          if (existing) existing.quantity += i.quantity;
          else map.set(key, { ...i, userId });
        });
        
        // Borrar TODO de la cuenta antes de insertar lo nuevo (Limpieza profunda)
        await prisma.cartItem.deleteMany({ where: { userId } });
        await prisma.cartItem.createMany({ data: Array.from(map.values()).map(i => ({
            userId, productId: i.productId, title: i.title, price: i.price, image: i.image, size: i.size, quantity: i.quantity
        }))});
      } 
      // 2. SI ES SINCRONIZACIÓN NORMAL: Reemplazo total (El front manda la verdad)
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
  }
}
};

const schema = createSchema({ typeDefs, resolvers });
const { handleRequest } = createYoga({ schema, graphqlEndpoint: '/api/graphql' });
export { handleRequest as GET, handleRequest as POST };