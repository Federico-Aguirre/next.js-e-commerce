import type { JWT } from 'next-auth/jwt';

export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const PLACEHOLDER_SECRET =
  /^(?:clave_secreta|reemplazar|replace(?:[-_ ]?me)?|change(?:[-_ ]?me)?|secret[-_ ]?for[-_ ]?development)/i;

export function resolveNextAuthSecret(
  secret: string | undefined,
  nodeEnv = process.env.NODE_ENV,
): string | undefined {
  const normalizedSecret = secret?.trim();

  if (nodeEnv === 'production') {
    if (
      !normalizedSecret ||
      normalizedSecret.length < 32 ||
      new Set(normalizedSecret).size < 12 ||
      PLACEHOLDER_SECRET.test(normalizedSecret)
    ) {
      throw new Error(
        'Production requires a non-placeholder NEXTAUTH_SECRET of at least 32 characters with sufficient character diversity.',
      );
    }
  }

  return normalizedSecret || undefined;
}

export type SessionIdentityLookup = { id: string } | { email: string };

export type CurrentSessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  isAdmin: boolean;
  isPlatformOwner: boolean;
};

/**
 * Refresh authorization-relevant JWT claims from the database on each JWT callback.
 * This makes admin demotions/deletions effective without waiting for token expiry.
 */
export async function refreshSessionTokenIdentity(
  token: JWT,
  findUser: (lookup: SessionIdentityLookup) => Promise<CurrentSessionUser | null>,
): Promise<JWT> {
  const lookup: SessionIdentityLookup | null =
    typeof token.id === 'string' && token.id.length > 0
      ? { id: token.id }
      : typeof token.email === 'string' && token.email.length > 0
        ? { email: token.email }
        : null;

  if (!lookup) {
    clearSessionIdentity(token);
    return token;
  }

  const currentUser = await findUser(lookup);

  if (!currentUser) {
    clearSessionIdentity(token);
    return token;
  }

  token.id = currentUser.id;
  token.email = currentUser.email ?? undefined;
  token.name = currentUser.name ?? undefined;
  token.isAdmin = currentUser.isAdmin;
  token.isPlatformOwner = currentUser.isPlatformOwner;

  return token;
}

function clearSessionIdentity(token: JWT) {
  delete token.id;
  delete token.email;
  delete token.name;
  delete token.sub;
  delete token.picture;
  token.isAdmin = false;
  token.isPlatformOwner = false;
}
