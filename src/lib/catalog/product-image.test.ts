import { describe, expect, it } from 'vitest';
import { FALLBACK_PRODUCT_IMAGE, normalizeProductImageUrl } from './product-image';

describe('normalizeProductImageUrl', () => {
  it('maps legacy product paths to the current public asset directory', () => {
    expect(normalizeProductImageUrl('/images/products/jacket1-1a.webp')).toBe(
      '/assets/images/products/jacket1-1a.webp',
    );
  });

  it('keeps paths that already use the current directory unchanged', () => {
    expect(normalizeProductImageUrl('/assets/images/products/shoes1-1a.webp')).toBe(
      '/assets/images/products/shoes1-1a.webp',
    );
  });

  it('uses an existing product image when the value is empty or the obsolete placeholder', () => {
    expect(normalizeProductImageUrl('')).toBe(FALLBACK_PRODUCT_IMAGE);
    expect(normalizeProductImageUrl(null)).toBe(FALLBACK_PRODUCT_IMAGE);
    expect(normalizeProductImageUrl('/placeholder.png')).toBe(FALLBACK_PRODUCT_IMAGE);
  });
});
