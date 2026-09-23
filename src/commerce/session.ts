import 'server-only';
import { cookies } from 'next/headers';

import { prisma } from '@/lib/prisma';

import type { SessionAuth, SessionUser } from './contracts';

const SESSION_COOKIE = 'session_user_id';

export const sessionAuth: SessionAuth = {
  async getCurrentUser() {
    const cookieStore = await cookies();
    const userId = cookieStore.get(SESSION_COOKIE)?.value;

    if (!userId) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user || !user.email) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? undefined,
    };
  },

  async requireCurrentUser() {
    const user = await this.getCurrentUser();

    if (!user) {
      throw new Error('Authentication required');
    }

    return user;
  },
};

export const assertCustomerOwnership = (
  ownerId: string | undefined,
  user: SessionUser,
): void => {
  if (!ownerId || ownerId !== user.id) {
    throw new Error('Resource does not belong to the current customer');
  }
};
