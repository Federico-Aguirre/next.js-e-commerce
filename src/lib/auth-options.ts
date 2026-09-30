import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from '@/lib/prisma';
import { compare } from 'bcryptjs';
import { Env } from '@/lib/env';

declare module 'next-auth' {
  type User = {
    isAdmin?: boolean;
  };
  type Session = {
    user: {
      id: string;
      isAdmin?: boolean;
    } & DefaultSession['user'];
  };
}

declare module 'next-auth/jwt' {
  type JWT = {
    id?: string;
    isAdmin?: boolean;
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET || Env.NEXTAUTH_SECRET || 'dev_secret_key_123456789',
  session: {
    strategy: 'jwt',
  },
  providers: [
    GoogleProvider({
      clientId: Env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: Env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Faltan datos de inicio de sesión');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
          throw new Error('Usuario no encontrado');
        }

        const isValidPassword = await compare(credentials.password, user.password);

        if (!isValidPassword) {
          throw new Error('Contraseña incorrecta');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
      } else if (token.email && token.isAdmin === undefined) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { isAdmin: true },
        });
        token.isAdmin = dbUser?.isAdmin;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.isAdmin !== undefined) {
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
};
