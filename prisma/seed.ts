// prisma/seed.ts
import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const fullProducts = [
  {
    id: 1,
    name: "Columbia Glennaker Waterproof Jacket",
    price: 24.99,
    description: "A lightweight, packable waterproof rain jacket featuring a durable nylon shell and a hideaway hood. Engineered to keep you bone-dry during sudden downpours.",
    category: "jackets",
    variants: [
      {
        colorName: "Black",
        images: ["/assets/images/products/jacket1-1a.webp", "/assets/images/products/jacket1-1b.webp"],
        skus: [{ articleId: 1, size: "S", stock: 15 }]
      },
      {
        colorName: "Black/City Grey",
        images: ["/assets/images/products/jacket1-2a.webp", "/assets/images/products/jacket1-2b.webp"],
        skus: [
          { articleId: 2, size: "S", stock: 1 },  
          { articleId: 3, size: "M", stock: 2 }   
        ]
      },
      {
        colorName: "Bright Aqua/Collegiate Navy",
        images: ["/assets/images/products/jacket1-3a.webp", "/assets/images/products/jacket1-3b.webp"],
        skus: [
          { articleId: 4, size: "S", stock: 0 },  
          { articleId: 5, size: "M", stock: 0 }, 
          { articleId: 6, size: "L", stock: 0 }
        ]
      }
    ]
  },
  {
    id: 2,
    name: "Van Heusen Flex Stretch Suit Jacket",
    price: 50.00,
    description: "Designed for modern professionals, this tailored suit jacket blends classic elegance with innovative flex-stretch fibers for natural, unrestricted movement.",
    category: "jackets",
    variants: [
      {
        colorName: "Black",
        images: ["/assets/images/products/jacket2-1a.webp", "/assets/images/products/jacket2-2a.webp"],
        skus: [
          { articleId: 7, size: "S", stock: 10 }, 
          { articleId: 8, size: "M", stock: 12 }, 
          { articleId: 9, size: "L", stock: 0 }, 
          { articleId: 10, size: "XL", stock: 5 }
        ]
      },
      {
        colorName: "Oxford Grey",
        images: ["/assets/images/products/jacket2-1b.webp", "/assets/images/products/jacket2-2b.webp"],
        skus: [
          { articleId: 11, size: "S", stock: 1 }, 
          { articleId: 12, size: "M", stock: 10 }, 
          { articleId: 13, size: "L", stock: 8 }
        ]
      },
      {
        colorName: "Blue Bank",
        images: ["/assets/images/products/jacket2-1c.webp", "/assets/images/products/jacket2-2c.webp"],
        skus: [
          { articleId: 14, size: "S", stock: 15 }, 
          { articleId: 15, size: "M", stock: 15 }
        ]
      }
    ]
  },
  {
    id: 3,
    name: "Under Armour Performance Baseball Pants",
    price: 17.64,
    description: "Durable, sweat-wicking baseball pants engineered with dual-layer knees for added protection.",
    category: "pants",
    variants: [
      {
        colorName: "White",
        images: ["/assets/images/products/pants1-1a.webp", "/assets/images/products/pants1-2a.webp"],
        skus: [
          { articleId: 16, size: "S", stock: 20 }, 
          { articleId: 17, size: "M", stock: 14 }
        ]
      },
      {
        colorName: "Black",
        images: ["/assets/images/products/pants1-1b.webp", "/assets/images/products/pants1-2b.webp"],
        skus: [
          { articleId: 18, size: "S", stock: 0 }, 
          { articleId: 19, size: "M", stock: 6 }
        ]
      },
      {
        colorName: "Aluminum",
        images: ["/assets/images/products/pants1-1c.webp", "/assets/images/products/pants1-2c.webp"],
        skus: [{ articleId: 20, size: "S", stock: 8 }]
      }
    ]
  },
  {
    id: 4,
    name: "Under Armour UA Waffle Henley Long Sleeve TShirt",
    price: 31.67,
    description: "Waffle-textured knit fabric traps warmth without adding bulk.",
    category: "tshirts",
    variants: [
      {
        colorName: "Academy/White - 408",
        images: ["/assets/images/products/tshirt1-1a.webp", "/assets/images/products/tshirt1-2a.webp"],
        skus: [
          { articleId: 21, size: "S", stock: 10 }, 
          { articleId: 22, size: "M", stock: 0 }
        ]
      },
      {
        colorName: "Baroque Green / Black-310",
        images: ["/assets/images/products/tshirt1-1b.webp", "/assets/images/products/tshirt1-2b.webp"],
        skus: [
          { articleId: 23, size: "S", stock: 14 }, 
          { articleId: 24, size: "M", stock: 12 }
        ]
      },
      {
        colorName: "Mod Gray / Black - 011",
        images: ["/assets/images/products/tshirt1-1c.webp", "/assets/images/products/tshirt1-2c.webp"],
        skus: [
          { articleId: 25, size: "S", stock: 8 }, 
          { articleId: 26, size: "M", stock: 7 }
        ]
      }
    ]
  },
  {
    id: 5,
    name: "Como Quieres Bleach Jogging Pants",
    price: 34.99,
    description: "Comfortable and stylish women's fleece joggers with a modern bleached finish.",
    category: "pants",
    variants: [
      { 
        colorName: "Grey", 
        images: ["/assets/images/products/pants2-1a.webp", "/assets/images/products/pants2-2a.webp"], 
        skus: [
          { articleId: 27, size: "S", stock: 10 }, 
          { articleId: 28, size: "M", stock: 8 }
        ] 
      },
      { 
        colorName: "Pink", 
        images: ["/assets/images/products/pants2-1b.webp", "/assets/images/products/pants2-2b.webp"], 
        skus: [
          { articleId: 29, size: "S", stock: 0 }, 
          { articleId: 30, size: "M", stock: 5 }
        ] 
      }
    ]
  },
  {
    id: 6,
    name: "Giannis Immortality 4 Basketball Shoes",
    price: 110.00,
    description: "Engineered for explosive movement and premium court control.",
    category: "sneakers",
    variants: [
      {
        colorName: "Blue 402",
        images: [
          "/assets/images/products/shoes1-1a.webp", 
          "/assets/images/products/shoes1-2a.webp", 
          "/assets/images/products/shoes1-3a.webp", 
          "/assets/images/products/shoes1-4a.webp", 
          "/assets/images/products/shoes1-5a.webp"
        ],
        skus: [
          { articleId: 31, size: "8", stock: 4 }, 
          { articleId: 32, size: "9", stock: 6 }, 
          { articleId: 33, size: "10", stock: 0 }
        ]
      }
    ]
  },
  {
    id: 7,
    name: "DC Shoes Pure Men's Skate Sneakers",
    price: 65.00,
    description: "The classic heritage skate shoe built for durability and performance.",
    category: "sneakers",
    variants: [
      { colorName: "Black", images: ["/assets/images/products/shoes2-1a.webp", "/assets/images/products/shoes2-2a.webp", "/assets/images/products/shoes2-3a.webp"], skus: [{ articleId: 34, size: "7", stock: 5 }, { articleId: 35, size: "8", stock: 10 }] },
      { colorName: "White", images: ["/assets/images/products/shoes2-1b.webp", "/assets/images/products/shoes2-2b.webp", "/assets/images/products/shoes2-3b.webp"], skus: [{ articleId: 36, size: "8", stock: 9 }, { articleId: 37, size: "9", stock: 7 }] }
    ]
  },
  {
    id: 8,
    name: "Modern Casual Henley Long Sleeve TShirt",
    price: 28.50,
    description: "A trendy, lightweight casual long-sleeve tee.",
    category: "tshirts",
    variants: [
      { colorName: "Navy Blue", images: ["/assets/images/products/tshirt2-1a.webp", "/assets/images/products/tshirt2-2a.webp"], skus: [{ articleId: 38, size: "M", stock: 12 }, { articleId: 39, size: "L", stock: 15 }] },
      { colorName: "Grey", images: ["/assets/images/products/tshirt2-1b.webp"], skus: [{ articleId: 40, size: "M", stock: 8 }] }
    ]
  },
  {
    id: 9,
    name: "Heavy-Duty Half-Zip Fleece Sweatshirt",
    price: 39.99,
    description: "Premium heavy fleece sweater with a functional mock-neck half-zip design.",
    category: "hoodies",
    variants: [
      { colorName: "Blue", images: ["/assets/images/products/sweatshirt1-1a.webp", "/assets/images/products/sweatshirt1-2a.webp", "/assets/images/products/sweatshirt1-3a.webp"], skus: [{ articleId: 41, size: "M", stock: 10 }] },
      { colorName: "Black", images: ["/assets/images/products/sweatshirt1-1b.webp", "/assets/images/products/sweatshirt1-2b.webp", "/assets/images/products/sweatshirt1-3b.webp"], skus: [{ articleId: 42, size: "S", stock: 8 }] }
    ]
  },
  {
    id: 10,
    name: "Premium Unisex High-Neck Fleece Sweatshirt",
    price: 42.00,
    description: "An ultra-soft unisex fleece pullover showcasing a modern high-neck collar structure. Designed to deliver superior thermal protection and long-lasting winter comfort.",
    category: "hoodies",
    variants: [
      { colorName: "Grey", images: ["/assets/images/products/sweatshirt2-1a.webp"], skus: [{ articleId: 43, size: "S", stock: 11 }, { articleId: 44, size: "M", stock: 9 }] },
      { colorName: "Red", images: ["/assets/images/products/sweatshirt2-1b.webp"], skus: [{ articleId: 45, size: "S", stock: 7 }] }
    ]
  }
];

async function main() {
  const cleanUrl = process.env.DATABASE_URL?.split('?')[0];
  const client = new Client({ connectionString: cleanUrl, ssl: { rejectUnauthorized: false } });

  console.log('🚀 Conectando a Aiven via PG...');
  await client.connect();

  try {
    console.log('🧹 Limpiando base de datos por completo en orden...');
    // Borrado seguro respetando las FK Constraints
    await client.query('DELETE FROM "ProductSku";');
    await client.query('DELETE FROM "VariantImage";');
    await client.query('DELETE FROM "ProductVariant";');
    await client.query('DELETE FROM "Product";');

    console.log('🌱 Sembrando catálogo profesional con paths de public/ e IDs únicos...');

    for (const prod of fullProducts) {
      await client.query(
        `INSERT INTO "Product" (id, name, description, price, category, "updatedAt") 
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [prod.id, prod.name, prod.description, prod.price, prod.category]
      );

      for (const variant of prod.variants) {
        const variantId = `v-${prod.id}-${variant.colorName.replace(/[\s\/]+/g, '-').toLowerCase()}`;
        
        await client.query(
          `INSERT INTO "ProductVariant" (id, "colorName", "productId") VALUES ($1, $2, $3)`,
          [variantId, variant.colorName, prod.id]
        );

        for (const imgUrl of variant.images) {
          const imgId = `img-${Math.random().toString(36).substr(2, 9)}`;
          await client.query(
            `INSERT INTO "VariantImage" (id, url, "variantId") VALUES ($1, $2, $3)`,
            [imgId, imgUrl, variantId]
          );
        }

        for (const sku of variant.skus) {
          const skuId = `sku-${sku.articleId}-${sku.size.toLowerCase()}`;
          await client.query(
            `INSERT INTO "ProductSku" (id, "articleId", size, stock, "variantId") 
             VALUES ($1, $2, $3, $4, $5)`,
            [skuId, sku.articleId, sku.size, sku.stock, variantId]
          );
        }
      }
    }

    console.log('✅ ¡Catálogo relacional inyectado con URLs de public/ listas!');
  } catch (err) {
    console.error('❌ Error inyectando el seed:', err);
  } finally {
    await client.end();
  }
}

main();