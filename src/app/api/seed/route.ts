// app/api/seed/route.ts
import { NextResponse } from 'next/server';
// 🔥 Usamos la instancia centralizada para evitar errores de compilación en CI/CD
import { prisma } from '@/lib/prisma';

const seedProducts = [
  {
    id: 1,
    name: "Columbia Glennaker Waterproof Jacket",
    price: 24.99,
    description: "A lightweight, packable waterproof rain jacket featuring a durable nylon shell and a hideaway hood.",
    category: "jackets",
    image: "/_next/static/media/jacket1-1a.webp", 
    variants: [
      { articleId: 1, colorName: "Black", sizes: ["S"], images: [{ id: "angle-a", url: "/_next/static/media/jacket1-1a.webp" }] },
      { articleId: 2, colorName: "Black/City Grey", sizes: ["S", "M"], images: [{ id: "angle-a", url: "/_next/static/media/jacket1-2a.webp" }] }
    ]
  },
  {
    id: 2,
    name: "Van Heusen Flex Stretch Suit Jacket",
    price: 50.00,
    description: "Designed for modern professionals, this tailored suit jacket blends classic elegance with flex-stretch.",
    category: "jackets",
    image: "/_next/static/media/jacket2-1a.webp",
    variants: [
      { articleId: 4, colorName: "Black", sizes: ["S", "M", "L"], images: [{ id: "angle-a", url: "/_next/static/media/jacket2-1a.webp" }] }
    ]
  },
  {
    id: 3,
    name: "Under Armour Performance Baseball Pants",
    price: 17.64,
    description: "Durable, sweat-wicking baseball pants engineered with dual-layer knees for added protection.",
    category: "pants",
    image: "/_next/static/media/pants1-1a.webp",
    variants: [
      { articleId: 7, colorName: "White", sizes: ["S", "M"], images: [{ id: "angle-a", url: "/_next/static/media/pants1-1a.webp" }] }
    ]
  },
  {
    id: 4,
    name: "Under Armour UA Waffle Henley Long Sleeve TShirt",
    price: 31.67,
    description: "Waffle-textured knit fabric traps warmth without adding bulk. Comfort and movement.",
    category: "tshirts",
    image: "/_next/static/media/tshirt1-1a.webp",
    variants: [
      { articleId: 10, colorName: "Academy/White", sizes: ["S", "M"], images: [{ id: "angle-a", url: "/_next/static/media/tshirt1-1a.webp" }] }
    ]
  }
];

export async function GET() {
  try {
    console.log('🌱 Ejecutando seed desde el servidor Next.js...');
    
    // Limpiamos
    await prisma.product.deleteMany({});

    // Insertamos
    for (const item of seedProducts) {
      await prisma.product.create({
        // 🚀 ARREGLADO: El "as any" va justo adentro del objeto de propiedades,
        // así Prisma recibe su campo 'data' feliz y TypeScript no analiza el contenido interno.
        data: {
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          variants: item.variants,
          stock: 10,
        } as any,
      });
    }

    return NextResponse.json({ success: true, message: "¡Productos sembrados con éxito en Aiven!" });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}