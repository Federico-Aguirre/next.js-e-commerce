import 'server-only';
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import type { NextRequest } from 'next/server';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

/**
 * Resolve identity only from a signed NextAuth session cookie or signed bearer token.
 * Never accept userId/email from request JSON or user-supplied identity headers.
 * Used by web routes and the native app's short-lived bearer session.
 */
export async function getAuthenticatedUser(request?: Request) {
  let userId: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (typeof session?.user?.id === 'string' && session.user.id.length > 0) {
      userId = session.user.id;
    }
  } catch {
    // Route handlers without a browser cookie may use the signed bearer token below.
  }

  if (!userId && request) {
    try {
      const token = await getToken({
        req: request as NextRequest,
        secret: process.env.NEXTAUTH_SECRET,
        secureCookie: process.env.NODE_ENV === 'production',
      });
      const candidate = token?.id ?? token?.sub;
      if (typeof candidate === 'string' && candidate.length > 0 && candidate.length <= 191) {
        userId = candidate;
      }
    } catch {
      return null;
    }
  }

  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
  });
}
