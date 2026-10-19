import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/** Return authoritative, current catalogue prices for locally persisted cart/wishlist entries. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { productIds?: unknown };
    if (!Array.isArray(body.productIds) || body.productIds.length > 100) {
      return NextResponse.json({ error: 'Invalid product list.' }, { status: 400 });
    }

    const productIds = [
      ...new Set(
        body.productIds
          .map((id) => (typeof id === 'string' ? Number(id) : id))
          .filter(
            (id): id is number => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
          ),
      ),
    ];

    if (productIds.length === 0) {
      return NextResponse.json({ products: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      select: { id: true, name: true, price: true, category: true },
    });

    return NextResponse.json(
      {
        currency: 'ARS',
        products: products.map((product) => ({
          id: product.id,
          title: product.name,
          price: product.price,
          category: product.category,
        })),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    console.error('Unable to refresh catalogue prices:', error);
    return NextResponse.json({ error: 'Unable to refresh catalogue prices.' }, { status: 500 });
  }
}
