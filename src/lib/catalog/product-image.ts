const FALLBACK_PRODUCT_IMAGE = '/assets/images/products/jacket1-1a.webp';

/**
 * Resolves legacy catalog image paths to the current public asset directory.
 * Keeps already-normalized local paths and external URLs unchanged.
 */
export function normalizeProductImageUrl(imageUrl?: string | null): string {
  const value = imageUrl?.trim();
  if (!value || value === '/placeholder.png') return FALLBACK_PRODUCT_IMAGE;

  if (value.startsWith('/images/')) {
    return value.replace(/^\/images\//, '/assets/images/');
  }

  return value;
}

export { FALLBACK_PRODUCT_IMAGE };
