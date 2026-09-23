export const assertIdempotencyKey = (key: string): string => {
  const normalized = key.trim();

  if (normalized.length < 16 || normalized.length > 255) {
    throw new Error('Idempotency key must contain 16 to 255 characters');
  }

  return normalized;
};
