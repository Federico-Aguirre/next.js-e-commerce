import bcrypt from 'bcryptjs';
import type { DefaultSession, NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import FacebookProvider from 'next-auth/providers/facebook';
import GoogleProvider from 'next-auth/providers/google';
import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';

// 1. Ampliación de tipos de NextAuth para TypeScript
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
          throw new Error('Usuario no encontrado o autenticado con proveedor');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Contraseña incorrecta');
        }

        // 2. Retornamos isAdmin en el objeto del usuario
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    // 3. Guardamos isAdmin en el JWT cuando el usuario se autentica
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.isAdmin = user.isAdmin;
      }
      return token;
    },
    // 4. Pasamos el id e isAdmin del token hacia la sesión del cliente/servidor
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.isAdmin = token.isAdmin as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: Env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET,
};
