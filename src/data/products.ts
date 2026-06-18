import { Product } from '@/types/product';

// 1. Jackets
import jacket1_1a from '@/assets/images/products/jacket1-1a.webp';
import jacket1_1b from '@/assets/images/products/jacket1-1b.webp';
import jacket1_2a from '@/assets/images/products/jacket1-2a.webp';
import jacket1_2b from '@/assets/images/products/jacket1-2b.webp';
import jacket1_3a from '@/assets/images/products/jacket1-3a.webp';
import jacket1_3b from '@/assets/images/products/jacket1-3b.webp';

import jacket2_1a from '@/assets/images/products/jacket2-1a.webp';
import jacket2_2a from '@/assets/images/products/jacket2-2a.webp';
import jacket2_1b from '@/assets/images/products/jacket2-1b.webp';
import jacket2_2b from '@/assets/images/products/jacket2-2b.webp';
import jacket2_1c from '@/assets/images/products/jacket2-1c.webp';
import jacket2_2c from '@/assets/images/products/jacket2-2c.webp';

// 2. Pants
import pants1_1a from '@/assets/images/products/pants1-1a.webp';
import pants1_2a from '@/assets/images/products/pants1-2a.webp';
import pants1_1b from '@/assets/images/products/pants1-1b.webp';
import pants1_2b from '@/assets/images/products/pants1-2b.webp';
import pants1_1c from '@/assets/images/products/pants1-1c.webp';
import pants1_2c from '@/assets/images/products/pants1-2c.webp';

import pants2_1a from '@/assets/images/products/pants2-1a.webp';
import pants2_2a from '@/assets/images/products/pants2-2a.webp';
import pants2_1b from '@/assets/images/products/pants2-1b.webp';
import pants2_2b from '@/assets/images/products/pants2-2b.webp';

// 3. Shirts / Tshirts
import tshirt1_1a from '@/assets/images/products/tshirt1-1a.webp';
import tshirt1_2a from '@/assets/images/products/tshirt1-2a.webp';
import tshirt1_1b from '@/assets/images/products/tshirt1-1b.webp';
import tshirt1_2b from '@/assets/images/products/tshirt1-2b.webp';
import tshirt1_1c from '@/assets/images/products/tshirt1-1c.webp';
import tshirt1_2c from '@/assets/images/products/tshirt1-2c.webp';

import tshirt2_1a from '@/assets/images/products/tshirt2-1a.webp';
import tshirt2_2a from '@/assets/images/products/tshirt2-2a.webp';
import tshirt2_1b from '@/assets/images/products/tshirt2-1b.webp';

// 4. Sneakers / Shoes
import shoes1_1a from '@/assets/images/products/shoes1-1a.webp';
import shoes1_2a from '@/assets/images/products/shoes1-2a.webp';
import shoes1_3a from '@/assets/images/products/shoes1-3a.webp';
import shoes1_4a from '@/assets/images/products/shoes1-4a.webp';
import shoes1_5a from '@/assets/images/products/shoes1-5a.webp';

import shoes2_1a from '@/assets/images/products/shoes2-1a.webp';
import shoes2_2a from '@/assets/images/products/shoes2-2a.webp';
import shoes2_3a from '@/assets/images/products/shoes2-3a.webp';
import shoes2_1b from '@/assets/images/products/shoes2-1b.webp';
import shoes2_2b from '@/assets/images/products/shoes2-2b.webp';
import shoes2_3b from '@/assets/images/products/shoes2-3b.webp';

// 5. Sweatshirts / Hoodies
import sweatshirt1_1a from '@/assets/images/products/sweatshirt1-1a.webp';
import sweatshirt1_2a from '@/assets/images/products/sweatshirt1-2a.webp';
import sweatshirt1_3a from '@/assets/images/products/sweatshirt1-3a.webp';
import sweatshirt1_1b from '@/assets/images/products/sweatshirt1-1b.webp';
import sweatshirt1_2b from '@/assets/images/products/sweatshirt1-2b.webp';
import sweatshirt1_3b from '@/assets/images/products/sweatshirt1-3b.webp';

import sweatshirt2_1a from '@/assets/images/products/sweatshirt2-1a.webp';
import sweatshirt2_1b from '@/assets/images/products/sweatshirt2-1b.webp';

export const productsData: Product[] = [
  {
    id: 1,
    title: "Columbia Glennaker Waterproof Jacket",
    price: 24.99,
    description: "A lightweight, packable waterproof rain jacket featuring a durable nylon shell and a hideaway hood. Engineered to keep you bone-dry during sudden downpours.",
    category: "jackets",
    image: jacket1_1a.src,
    variants: [
      {
        articleId: 1,
        colorName: "Black",
        sizes: ["S"],
        images: [
          { id: "angle-a", url: jacket1_1a.src },
          { id: "angle-b", url: jacket1_1b.src }
        ]
      },
      {
        articleId: 2,
        colorName: "Black/City Grey",
        sizes: ["S", "M"],
        images: [
          { id: "angle-a", url: jacket1_2a.src },
          { id: "angle-b", url: jacket1_2b.src }
        ]
      },
      {
        articleId: 3,
        colorName: "Bright Aqua/Collegiate Navy",
        sizes: ["S", "M", "L"],
        images: [
          { id: "angle-a", url: jacket1_3a.src },
          { id: "angle-b", url: jacket1_3b.src }
        ]
      }
    ]
  },
  {
    id: 2,
    title: "Van Heusen Flex Stretch Suit Jacket",
    price: 50.00,
    description: "Designed for modern professionals, this tailored suit jacket blends classic elegance with innovative flex-stretch fibers for natural, unrestricted movement.",
    category: "jackets",
    image: jacket2_1a.src,
    variants: [
      {
        articleId: 4,
        colorName: "Black",
        sizes: ["S", "M", "L", "XL"],
        images: [
          { id: "angle-a", url: jacket2_1a.src },
          { id: "angle-b", url: jacket2_2a.src }
        ]
      },
      {
        articleId: 5,
        colorName: "Oxford Grey",
        sizes: ["S", "M", "L", "XL", "XLL"],
        images: [
          { id: "angle-a", url: jacket2_1b.src },
          { id: "angle-b", url: jacket2_2b.src }
        ]
      },
      {
        articleId: 6,
        colorName: "Blue Bank",
        sizes: ["S", "M", "L", "XL"],
        images: [
          { id: "angle-a", url: jacket2_1c.src },
          { id: "angle-b", url: jacket2_2c.src }
        ]
      }
    ]
  },
  {
    id: 3,
    title: "Under Armour Performance Baseball Pants",
    price: 17.64,
    description: "Durable, sweat-wicking baseball pants engineered with dual-layer knees for added protection. Clean waistband design built to stay comfortable through extra innings.",
    category: "pants",
    image: pants1_1a.src,
    variants: [
      {
        articleId: 7,
        colorName: "White",
        sizes: ["S", "M", "L"],
        images: [
          { id: "angle-a", url: pants1_1a.src },
          { id: "angle-b", url: pants1_2a.src }
        ]
      },
      {
        articleId: 8,
        colorName: "Black",
        sizes: ["S", "M"],
        images: [
          { id: "angle-a", url: pants1_1b.src },
          { id: "angle-b", url: pants1_2b.src }
        ]
      },
      {
        articleId: 9,
        colorName: "Aluminum",
        sizes: ["S"],
        images: [
          { id: "angle-a", url: pants1_1c.src },
          { id: "angle-b", url: pants1_2c.src }
        ]
      }
    ]
  },
  {
    id: 4,
    title: "Under Armour UA Waffle Henley Long Sleeve TShirt",
    price: 31.67,
    description: "Waffle-textured knit fabric traps warmth without adding bulk. A comfortable, versatile long sleeve Henley designed to move seamlessly with your body.",
    category: "tshirts",
    image: tshirt1_1a.src,
    variants: [
      {
        articleId: 10,
        colorName: "Academy/White - 408",
        sizes: ["S", "M"],
        images: [
          { id: "angle-a", url: tshirt1_1a.src },
          { id: "angle-b", url: tshirt1_2a.src }
        ]
      },
      {
        articleId: 11,
        colorName: "Baroque Green / Black-310",
        sizes: ["S", "M", "L"],
        images: [
          { id: "angle-a", url: tshirt1_1b.src },
          { id: "angle-b", url: tshirt1_2b.src }
        ]
      },
      {
        articleId: 12,
        colorName: "Mod Gray / Black - 011",
        sizes: ["S", "M", "L", "XL"],
        images: [
          { id: "angle-a", url: tshirt1_1c.src },
          { id: "angle-b", url: tshirt1_2c.src }
        ]
      }
    ]
  },
  {
    id: 5,
    title: "Como Quieres Bleach Jogging Pants",
    price: 34.99,
    description: "Comfortable and stylish women's fleece joggers with a modern bleached finish. Ideal for casual daily wear, lounging, or light workouts.",
    category: "pants",
    image: pants2_1a.src,
    variants: [
      {
        articleId: 13,
        colorName: "Grey",
        sizes: ["S", "M", "L"],
        images: [
          { id: "angle-a", url: pants2_1a.src },
          { id: "angle-b", url: pants2_2a.src }
        ]
      },
      {
        articleId: 14,
        colorName: "Pink",
        sizes: ["S", "M"],
        images: [
          { id: "angle-a", url: pants2_1b.src },
          { id: "angle-b", url: pants2_2b.src }
        ]
      }
    ]
  },
  {
    id: 6,
    title: "Giannis Immortality 4 Basketball Shoes",
    price: 110.00,
    description: "Engineered for explosive movement and premium court control. Features responsive cushioning and a multi-directional traction pattern inspired by Giannis's powerful gameplay.",
    category: "sneakers",
    image: shoes1_1a.src,
    variants: [
      {
        articleId: 15,
        colorName: "Blue 402",
        sizes: ["8", "9", "10", "11"],
        images: [
          { id: "angle-1", url: shoes1_1a.src },
          { id: "angle-2", url: shoes1_2a.src },
          { id: "angle-3", url: shoes1_3a.src },
          { id: "angle-4", url: shoes1_4a.src },
          { id: "angle-5", url: shoes1_5a.src }
        ]
      }
    ]
  },
  {
    id: 7,
    title: "DC Shoes Pure Men's Skate Sneakers",
    price: 65.00,
    description: "The classic heritage skate shoe built for durability and performance. Features a heavily padded collar and tongue, wrap-around sole construction, and a highly abrasion-resistant rubber outsole.",
    category: "sneakers",
    image: shoes2_1a.src,
    variants: [
      {
        articleId: 16,
        colorName: "Black",
        sizes: ["7", "8", "9", "10", "11"],
        images: [
          { id: "angle-1", url: shoes2_1a.src },
          { id: "angle-2", url: shoes2_2a.src },
          { id: "angle-3", url: shoes2_3a.src }
        ]
      },
      {
        articleId: 17,
        colorName: "White",
        sizes: ["8", "9", "10"],
        images: [
          { id: "angle-1", url: shoes2_1b.src },
          { id: "angle-2", url: shoes2_2b.src },
          { id: "angle-3", url: shoes2_3b.src }
        ]
      }
    ]
  },
  {
    id: 8,
    title: "Modern Casual Henley Long Sleeve TShirt",
    price: 28.50,
    description: "A trendy, lightweight casual long-sleeve tee featuring a traditional button-up Henley neckline. Extremely soft texture providing a sharp look for casual outings.",
    category: "tshirts",
    image: tshirt2_1a.src,
    variants: [
      {
        articleId: 18,
        colorName: "Navy Blue",
        sizes: ["M", "L", "XL"],
        images: [
          { id: "angle-a", url: tshirt2_1a.src },
          { id: "angle-b", url: tshirt2_2a.src }
        ]
      },
      {
        articleId: 19,
        colorName: "Grey",
        sizes: ["S", "M", "L"],
        images: [
          { id: "angle-a", url: tshirt2_1b.src }
        ]
      }
    ]
  },
  {
    id: 9,
    title: "Heavy-Duty Half-Zip Fleece Sweatshirt",
    price: 39.99,
    description: "Premium heavy fleece sweater with a functional mock-neck half-zip design. Thermal insulation engineered for professional work environments or extreme cold weather outdoor activities.",
    category: "hoodies",
    image: sweatshirt1_1a.src,
    variants: [
      {
        articleId: 20,
        colorName: "Blue",
        sizes: ["M", "L", "XL", "XXL"],
        images: [
          { id: "angle-1", url: sweatshirt1_1a.src },
          { id: "angle-2", url: sweatshirt1_2a.src },
          { id: "angle-3", url: sweatshirt1_3a.src }
        ]
      },
      {
        articleId: 21,
        colorName: "Black",
        sizes: ["S", "M", "L", "XL"],
        images: [
          { id: "angle-1", url: sweatshirt1_1b.src },
          { id: "angle-2", url: sweatshirt1_2b.src },
          { id: "angle-3", url: sweatshirt1_3b.src }
        ]
      }
    ]
  },
  {
    id: 10,
    title: "Premium Unisex High-Neck Fleece Sweatshirt",
    price: 42.00,
    description: "An ultra-soft unisex fleece pullover showcasing a modern high-neck collar structure. Designed to deliver superior thermal protection and long-lasting winter comfort.",
    category: "hoodies",
    image: sweatshirt2_1a.src,
    variants: [
      {
        articleId: 22,
        colorName: "Grey",
        sizes: ["S", "M", "L"],
        images: [
          { id: "angle-a", url: sweatshirt2_1a.src }
        ]
      },
      {
        articleId: 23,
        colorName: "Red",
        sizes: ["S", "M", "L", "XL"],
        images: [
          { id: "angle-b", url: sweatshirt2_1b.src }
        ]
      }
    ]
  }
];