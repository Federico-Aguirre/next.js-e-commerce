import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import FacebookProvider from 'next-auth/providers/facebook';
import GoogleProvider from 'next-auth/providers/google';
import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET || Env.NEXTAUTH_SECRET || 'dev_secret_key_123456789',
  // En desarrollo la app puede abrirse por localhost/HTTP o por ngrok/HTTPS.
  // No fijamos Secure en ese entorno para que la sesión funcione en ambos casos.
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: {
    strategy: 'jwt', // Necesario para combinar PrismaAdapter con CredentialsProvider
  },
  providers: [
    GoogleProvider({
      clientId: Env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: Env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: { params: { prompt: 'select_account' } },
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

        return {
          id: user.id,
          name: user.name,
          email: user.email,
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
      if (session.user) {
        if (token.id) {
          session.user.id = token.id as string;
        }
        if (token.isAdmin !== undefined) {
          session.user.isAdmin = token.isAdmin as boolean;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
};
