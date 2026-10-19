import 'dotenv/config';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { productsData } from '../src/data/products';

/** Matches the one-time USD -> ARS conversion used by the existing catalog migration. */
const USD_TO_ARS_RATE = 1514.5655;
const dryRun = process.argv.includes('--dry-run');
const IMPORTED_PRODUCT_IDS = [
  83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 162, 163, 164, 165, 166, 177, 178, 179, 180, 181, 185,
  186, 187, 188, 189,
] as const;

function arsPriceFromImportedUsd(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Precio fuente inválido: ${value}`);
  }
  return Math.round((value * USD_TO_ARS_RATE + Number.EPSILON) * 100) / 100;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');

  const sourceById = new Map(productsData.map((product) => [product.id, product]));
  const sourceMissing = IMPORTED_PRODUCT_IDS.filter((id) => !sourceById.has(id));
  if (sourceMissing.length) {
    throw new Error(`Faltan productos de origen esperados: ${sourceMissing.join(', ')}`);
  }
  const importedProducts = IMPORTED_PRODUCT_IDS.map((id) => sourceById.get(id)!);

  // Validate every referenced local asset before even considering a database write.
  for (const product of importedProducts) {
    if (product.variants.length === 0) throw new Error(`Producto ${product.id} sin variantes.`);
    for (const variant of product.variants) {
      if (variant.skus.length === 0) {
        throw new Error(`Producto ${product.id}, variante ${variant.colorName}: sin talles/SKU.`);
      }
      for (const image of variant.images) {
        if (!image.url.startsWith('/assets/images/products/')) {
          throw new Error(`Ruta de imagen inesperada para ${product.id}: ${image.url}`);
        }
        const assetPath = join(process.cwd(), 'public', image.url.replace(/^\/+/, ''));
        if (!existsSync(assetPath)) {
          throw new Error(`No existe la imagen del producto ${product.id}: ${image.url}`);
        }
      }
    }
  }

  const allArticleIds = importedProducts.flatMap((product) =>
    product.variants.flatMap((variant) => variant.skus.map((sku) => sku.articleId)),
  );
  if (new Set(allArticleIds).size !== allArticleIds.length) {
    throw new Error('Hay articleId repetidos en los SKU del catálogo importado.');
  }

  // Remove URL query parameters because the pg Pool receives explicit SSL settings below.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL.split('?')[0],
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 10_000,
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const sourceIds = [...IMPORTED_PRODUCT_IDS];
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: sourceIds } },
      select: { id: true, name: true },
    });
    const existingIds = new Set(existingProducts.map((product) => product.id));
    const missingProducts = importedProducts.filter((product) => !existingIds.has(product.id));

    // Existing products are never edited. Detect conflicting inventory before inserting any row.
    const missingArticleIds = missingProducts.flatMap((product) =>
      product.variants.flatMap((variant) => variant.skus.map((sku) => sku.articleId)),
    );
    if (missingArticleIds.length) {
      const existingSkus = await prisma.productSku.findMany({
        where: { articleId: { in: missingArticleIds } },
        select: { articleId: true, variant: { select: { productId: true } } },
      });
      if (existingSkus.length) {
        throw new Error(
          `No se insertó nada: hay articleId existentes fuera de los productos que faltan (${existingSkus
            .map((sku) => sku.articleId)
            .join(', ')}).`,
        );
      }
    }

    console.log(`Productos fuente revisados: ${importedProducts.length}`);
    console.log(
      `Productos que ya existen y se conservarán sin cambios: ${existingProducts.length}`,
    );
    console.log(`Productos nuevos listos para añadir: ${missingProducts.length}`);
    console.log(
      `Imágenes locales verificadas: ${importedProducts.reduce((count, product) => count + product.variants.reduce((sum, variant) => sum + variant.images.length, 0), 0)}`,
    );
    console.log(
      `Moneda base guardada: ARS (factor coherente con la conversión existente: ${USD_TO_ARS_RATE})`,
    );
    for (const product of missingProducts) {
      console.log(
        `  + ${product.id} · ${product.name} · $${arsPriceFromImportedUsd(product.price).toLocaleString('es-AR')} ARS`,
      );
    }

    if (dryRun || missingProducts.length === 0) {
      console.log(
        dryRun ? 'DRY RUN: no se modificó la base de datos.' : 'No hay productos que añadir.',
      );
      return;
    }

    const variants = missingProducts.flatMap((product) =>
      product.variants.map((variant, variantIndex) => ({
        id: `imported-variant-${product.id}-${variantIndex + 1}`,
        colorName: variant.sourceColorName ?? variant.colorName,
        productId: product.id,
        product,
        variant,
        variantIndex,
      })),
    );
    const images = variants.flatMap(({ product, variant, variantIndex, id: _variantId }) =>
      variant.images.map((image, imageIndex) => ({
        id: `imported-image-${product.id}-${variantIndex + 1}-${imageIndex + 1}`,
        url: image.url,
        variantId: `imported-variant-${product.id}-${variantIndex + 1}`,
      })),
    );
    const skus = variants.flatMap(({ variant, product, variantIndex }) =>
      variant.skus.map((sku) => ({
        id: `imported-sku-${sku.articleId}`,
        articleId: sku.articleId,
        size: sku.size,
        stock: sku.stock,
        variantId: `imported-variant-${product.id}-${variantIndex + 1}`,
      })),
    );

    await prisma.$transaction(
      async (tx) => {
        // Explicit bulk inserts in FK order avoid nested-write ambiguity and per-row query overhead.
        await tx.product.createMany({
          data: missingProducts.map((product) => ({
            id: product.id,
            name: product.name,
            description: product.description,
            price: arsPriceFromImportedUsd(product.price),
            category: product.category,
            isActive: true,
          })),
        });
        if (variants.length)
          await tx.productVariant.createMany({
            data: variants.map(({ product, variant, variantIndex }) => ({
              id: `imported-variant-${product.id}-${variantIndex + 1}`,
              colorName: variant.sourceColorName ?? variant.colorName,
              productId: product.id,
            })),
          });
        if (images.length) await tx.variantImage.createMany({ data: images });
        if (skus.length) await tx.productSku.createMany({ data: skus });
      },
      { maxWait: 10_000, timeout: 30_000 },
    );

    console.log(
      `Se añadieron ${missingProducts.length} productos con variantes, imágenes y stock inicial.`,
    );
    console.log('No se actualizaron productos existentes, ni se modificaron pedidos o usuarios.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    'No se pudo sincronizar el catálogo importado:',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
