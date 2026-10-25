import 'server-only';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import FacebookProvider from 'next-auth/providers/facebook';
import GoogleProvider from 'next-auth/providers/google';
import {
  refreshSessionTokenIdentity,
  resolveNextAuthSecret,
  SESSION_MAX_AGE_SECONDS,
  type SessionIdentityLookup,
} from '@/lib/auth/session-security';
import { Env } from '@/lib/Env';
import { prisma } from '@/lib/prisma';
import {
  checkRateLimit,
  getRequestClientIpFromHeaders,
  hashRateLimitIdentity,
} from '@/lib/security/rate-limit';

const invalidCredentialsMessage = 'Correo electrónico o contraseña incorrectos';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: resolveNextAuthSecret(process.env.NEXTAUTH_SECRET, process.env.NODE_ENV),
  // NextAuth usa cookies HttpOnly y SameSite=Lax por defecto; Secure se activa en producción.
  useSecureCookies: process.env.NODE_ENV === 'production',
  session: {
    strategy: 'jwt', // Necesario para combinar PrismaAdapter con CredentialsProvider
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE_SECONDS,
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
      async authorize(credentials, request) {
        const ip = getRequestClientIpFromHeaders(request.headers ?? {});
        const ipLimit = checkRateLimit('credentials-login:ip:' + hashRateLimitIdentity(ip), {
          limit: 12,
          windowMs: 15 * 60_000,
        });
        if (!ipLimit.allowed) {
          throw new Error(invalidCredentialsMessage);
        }

        const email = credentials?.email?.trim().toLowerCase() ?? '';
        const password = credentials?.password ?? '';
        if (!email || email.length > 254 || !password || password.length > 128) {
          throw new Error(invalidCredentialsMessage);
        }

        const emailLimit = checkRateLimit(
          'credentials-login:email:' + hashRateLimitIdentity(email),
          { limit: 8, windowMs: 15 * 60_000 },
        );
        if (!emailLimit.allowed) {
          throw new Error(invalidCredentialsMessage);
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user?.password) {
          throw new Error(invalidCredentialsMessage);
        }

        const isValid = await bcrypt.compare(password, user.password);

        if (!isValid) {
          throw new Error(invalidCredentialsMessage);
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
      if (user?.id) {
        token.id = user.id;
      }

      return refreshSessionTokenIdentity(token, async (lookup: SessionIdentityLookup) => {
        const where = 'id' in lookup ? { id: lookup.id } : { email: lookup.email };

        return prisma.user.findUnique({
          where,
          select: {
            id: true,
            email: true,
            name: true,
            isAdmin: true,
            isPlatformOwner: true,
          },
        });
      });
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === 'string' ? token.id : '';
        session.user.isAdmin = token.isAdmin === true;
        session.user.isPlatformOwner = token.isPlatformOwner === true;
        session.user.email = typeof token.email === 'string' ? token.email : null;
        session.user.name = typeof token.name === 'string' ? token.name : null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/sign-in',
  },
};
