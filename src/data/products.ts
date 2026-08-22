import { Product } from '@/types/product';

export const productsData: Product[] = [
  {
    id: 1,
    name: "Columbia Glennaker Waterproof Jacket",
    price: 24.99,
    description: "A lightweight, packable waterproof rain jacket featuring a durable nylon shell and a hideaway hood. Engineered to keep you bone-dry during sudden downpours.",
    category: "jackets",
    variants: [
      {
        id: "v1",
        colorName: "Black",
        images: [
          { id: "angle-1-1a", url: "/images/products/jacket1-1a.webp" },
          { id: "angle-1-1b", url: "/images/products/jacket1-1b.webp" }
        ],
        skus: [
          { id: "s1", articleId: 1, size: "S", stock: 10 }
        ]
      },
      {
        id: "v2",
        colorName: "Black/City Grey",
        images: [
          { id: "angle-1-2a", url: "/images/products/jacket1-2a.webp" },
          { id: "angle-1-2b", url: "/images/products/jacket1-2b.webp" }
        ],
        skus: [
          { id: "s2", articleId: 2, size: "S", stock: 5 },
          { id: "s3", articleId: 3, size: "M", stock: 12 }
        ]
      },
      {
        id: "v3",
        colorName: "Bright Aqua/Collegiate Navy",
        images: [
          { id: "angle-1-3a", url: "/images/products/jacket1-3a.webp" },
          { id: "angle-1-3b", url: "/images/products/jacket1-3b.webp" }
        ],
        skus: [
          { id: "s4", articleId: 4, size: "S", stock: 8 },
          { id: "s5", articleId: 5, size: "M", stock: 0 },
          { id: "s6", articleId: 6, size: "L", stock: 15 }
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
        id: "v4",
        colorName: "Black",
        images: [
          { id: "angle-2-1a", url: "/images/products/jacket2-1a.webp" },
          { id: "angle-2-2a", url: "/images/products/jacket2-2a.webp" }
        ],
        skus: [
          { id: "s7", articleId: 7, size: "S", stock: 10 },
          { id: "s8", articleId: 8, size: "M", stock: 10 },
          { id: "s9", articleId: 9, size: "L", stock: 7 },
          { id: "s10", articleId: 10, size: "XL", stock: 4 }
        ]
      },
      {
        id: "v5",
        colorName: "Oxford Grey",
        images: [
          { id: "angle-2-1b", url: "/images/products/jacket2-1b.webp" },
          { id: "angle-2-2b", url: "/images/products/jacket2-2b.webp" }
        ],
        skus: [
          { id: "s11", articleId: 11, size: "S", stock: 6 },
          { id: "s12", articleId: 12, size: "M", stock: 14 },
          { id: "s13", articleId: 13, size: "L", stock: 3 },
          { id: "s14", articleId: 14, size: "XL", stock: 9 }
        ]
      },
      {
        id: "v6",
        colorName: "Blue Bank",
        images: [
          { id: "angle-2-1c", url: "/images/products/jacket2-1c.webp" },
          { id: "angle-2-2c", url: "/images/products/jacket2-2c.webp" }
        ],
        skus: [
          { id: "s15", articleId: 15, size: "S", stock: 10 },
          { id: "s16", articleId: 16, size: "M", stock: 11 },
          { id: "s17", articleId: 17, size: "L", stock: 0 },
          { id: "s18", articleId: 18, size: "XL", stock: 5 }
        ]
      }
    ]
  },
  {
    id: 3,
    name: "Under Armour Performance Baseball Pants",
    price: 17.64,
    description: "Durable, sweat-wicking baseball pants engineered with dual-layer knees for added protection. Clean waistband design built to stay comfortable through extra innings.",
    category: "pants",
    variants: [
      {
        id: "v7",
        colorName: "White",
        images: [
          { id: "angle-3-1a", url: "/images/products/pants1-1a.webp" },
          { id: "angle-3-2a", url: "/images/products/pants1-2a.webp" }
        ],
        skus: [
          { id: "s19", articleId: 19, size: "S", stock: 8 },
          { id: "s20", articleId: 20, size: "M", stock: 15 },
          { id: "s21", articleId: 21, size: "L", stock: 12 }
        ]
      },
      {
        id: "v8",
        colorName: "Black",
        images: [
          { id: "angle-3-1b", url: "/images/products/pants1-1b.webp" },
          { id: "angle-3-2b", url: "/images/products/pants1-2b.webp" }
        ],
        skus: [
          { id: "s22", articleId: 22, size: "S", stock: 4 },
          { id: "s23", articleId: 23, size: "M", stock: 9 }
        ]
      },
      {
        id: "v9",
        colorName: "Aluminum",
        images: [
          { id: "angle-3-1c", url: "/images/products/pants1-1c.webp" },
          { id: "angle-3-2c", url: "/images/products/pants1-2c.webp" }
        ],
        skus: [
          { id: "s24", articleId: 24, size: "S", stock: 11 }
        ]
      }
    ]
  },
  {
    id: 4,
    name: "Under Armour UA Waffle Henley Long Sleeve TShirt",
    price: 31.67,
    description: "Waffle-textured knit fabric traps warmth without adding bulk. A comfortable, versatile long sleeve Henley designed to move seamlessly with your body.",
    category: "tshirts",
    variants: [
      {
        id: "v10",
        colorName: "Academy/White - 408",
        images: [
          { id: "angle-4-1a", url: "/images/products/tshirt1-1a.webp" },
          { id: "angle-4-2a", url: "/images/products/tshirt1-2a.webp" }
        ],
        skus: [
          { id: "s25", articleId: 25, size: "S", stock: 10 },
          { id: "s26", articleId: 26, size: "M", stock: 6 }
        ]
      },
      {
        id: "v11",
        colorName: "Baroque Green / Black-310",
        images: [
          { id: "angle-4-1b", url: "/images/products/tshirt1-1b.webp" },
          { id: "angle-4-2b", url: "/images/products/tshirt1-2b.webp" }
        ],
        skus: [
          { id: "s27", articleId: 27, size: "S", stock: 14 },
          { id: "s28", articleId: 28, size: "M", stock: 12 },
          { id: "s29", articleId: 29, size: "L", stock: 5 }
        ]
      },
      {
        id: "v12",
        colorName: "Mod Gray / Black - 011",
        images: [
          { id: "angle-4-1c", url: "/images/products/tshirt1-1c.webp" },
          { id: "angle-4-2c", url: "/images/products/tshirt1-2c.webp" }
        ],
        skus: [
          { id: "s30", articleId: 30, size: "S", stock: 8 },
          { id: "s31", articleId: 31, size: "M", stock: 20 },
          { id: "s32", articleId: 32, size: "L", stock: 15 },
          { id: "s33", articleId: 33, size: "XL", stock: 2 }
        ]
      }
    ]
  },
  {
    id: 5,
    name: "Como Quieres Bleach Jogging Pants",
    price: 34.99,
    description: "Comfortable and stylish women's fleece joggers with a modern bleached finish. Ideal for casual daily wear, lounging, or light workouts.",
    category: "pants",
    variants: [
      {
        id: "v13",
        colorName: "Grey",
        images: [
          { id: "angle-5-1a", url: "/images/products/pants2-1a.webp" },
          { id: "angle-5-2a", url: "/images/products/pants2-2a.webp" }
        ],
        skus: [
          { id: "s34", articleId: 34, size: "S", stock: 5 },
          { id: "s35", articleId: 35, size: "M", stock: 10 },
          { id: "s36", articleId: 36, size: "L", stock: 8 }
        ]
      },
      {
        id: "v14",
        colorName: "Pink",
        images: [
          { id: "angle-5-1b", url: "/images/products/pants2-1b.webp" },
          { id: "angle-5-2b", url: "/images/products/pants2-2b.webp" }
        ],
        skus: [
          { id: "s37", articleId: 37, size: "S", stock: 3 },
          { id: "s38", articleId: 38, size: "M", stock: 7 }
        ]
      }
    ]
  },
  {
    id: 6,
    name: "Giannis Immortality 4 Basketball Shoes",
    price: 110.00,
    description: "Engineered for explosive movement and premium court control. Features responsive cushioning and a multi-directional traction pattern inspired by Giannis's powerful gameplay.",
    category: "sneakers",
    variants: [
      {
        id: "v15",
        colorName: "Blue 402",
        images: [
          { id: "angle-6-1", url: "/images/products/shoes1-1a.webp" },
          { id: "angle-6-2", url: "/images/products/shoes1-2a.webp" },
          { id: "angle-6-3", url: "/images/products/shoes1-3a.webp" },
          { id: "angle-6-4", url: "/images/products/shoes1-4a.webp" },
          { id: "angle-6-5", url: "/images/products/shoes1-5a.webp" }
        ],
        skus: [
          { id: "s39", articleId: 39, size: "8", stock: 4 },
          { id: "s40", articleId: 40, size: "9", stock: 6 },
          { id: "s41", articleId: 41, size: "10", stock: 11 },
          { id: "s42", articleId: 42, size: "11", stock: 2 }
        ]
      }
    ]
  },
  {
    id: 7,
    name: "DC Shoes Pure Men's Skate Sneakers",
    price: 65.00,
    description: "The classic heritage skate shoe built for durability and performance. Features a heavily padded collar and tongue, wrap-around sole construction, and a highly abrasion-resistant rubber outsole.",
    category: "sneakers",
    variants: [
      {
        id: "v16",
        colorName: "Black",
        images: [
          { id: "angle-7-1", url: "/images/products/shoes2-1a.webp" },
          { id: "angle-7-2", url: "/images/products/shoes2-2a.webp" },
          { id: "angle-7-3", url: "/images/products/shoes2-3a.webp" }
        ],
        skus: [
          { id: "s43", articleId: 43, size: "7", stock: 5 },
          { id: "s44", articleId: 44, size: "8", stock: 8 },
          { id: "s45", articleId: 45, size: "9", stock: 14 },
          { id: "s46", articleId: 46, size: "10", stock: 3 },
          { id: "s47", articleId: 47, size: "11", stock: 6 }
        ]
      },
      {
        id: "v17",
        colorName: "White",
        images: [
          { id: "angle-7-4", url: "/images/products/shoes2-1b.webp" },
          { id: "angle-7-5", url: "/images/products/shoes2-2b.webp" },
          { id: "angle-7-6", url: "/images/products/shoes2-3b.webp" }
        ],
        skus: [
          { id: "s48", articleId: 48, size: "8", stock: 12 },
          { id: "s49", articleId: 49, size: "9", stock: 9 },
          { id: "s50", articleId: 50, size: "10", stock: 4 }
        ]
      }
    ]
  },
  {
    id: 8,
    name: "Modern Casual Henley Long Sleeve TShirt",
    price: 28.50,
    description: "A trendy, lightweight casual long-sleeve tee featuring a traditional button-up Henley neckline. Extremely soft texture providing a sharp look for casual outings.",
    category: "tshirts",
    variants: [
      {
        id: "v18",
        colorName: "Navy Blue",
        images: [
          { id: "angle-8-1a", url: "/images/products/tshirt2-1a.webp" },
          { id: "angle-8-2a", url: "/images/products/tshirt2-2a.webp" }
        ],
        skus: [
          { id: "s51", articleId: 51, size: "M", stock: 10 },
          { id: "s52", articleId: 52, size: "L", stock: 14 },
          { id: "s53", articleId: 53, size: "XL", stock: 7 }
        ]
      },
      {
        id: "v19",
        colorName: "Grey",
        images: [
          { id: "angle-8-1b", url: "/images/products/tshirt2-1b.webp" }
        ],
        skus: [
          { id: "s54", articleId: 54, size: "S", stock: 8 },
          { id: "s55", articleId: 55, size: "M", stock: 11 },
          { id: "s56", articleId: 56, size: "L", stock: 15 }
        ]
      }
    ]
  },
  {
    id: 9,
    name: "Heavy-Duty Half-Zip Fleece Sweatshirt",
    price: 39.99,
    description: "Premium heavy fleece sweater with a functional mock-neck half-zip design. Thermal insulation engineered for professional work environments or extreme cold weather outdoor activities.",
    category: "hoodies",
    variants: [
      {
        id: "v20",
        colorName: "Blue",
        images: [
          { id: "angle-9-1", url: "/images/products/sweatshirt1-1a.webp" },
          { id: "angle-9-2", url: "/images/products/sweatshirt1-2a.webp" },
          { id: "angle-9-3", url: "/images/products/sweatshirt1-3a.webp" }
        ],
        skus: [
          { id: "s57", articleId: 57, size: "M", stock: 12 },
          { id: "s58", articleId: 58, size: "L", stock: 18 },
          { id: "s59", articleId: 59, size: "XL", stock: 5 },
          { id: "s60", articleId: 60, size: "XXL", stock: 3 }
        ]
      },
      {
        id: "v21",
        colorName: "Black",
        images: [
          { id: "angle-9-4", url: "/images/products/sweatshirt1-1b.webp" },
          { id: "angle-9-5", url: "/images/products/sweatshirt1-2b.webp" },
          { id: "angle-9-6", url: "/images/products/sweatshirt1-3b.webp" }
        ],
        skus: [
          { id: "s61", articleId: 61, size: "S", stock: 7 },
          { id: "s62", articleId: 62, size: "M", stock: 14 },
          { id: "s63", articleId: 63, size: "L", stock: 10 },
          { id: "s64", articleId: 64, size: "XL", stock: 8 }
        ]
      }
    ]
  },
  {
    id: 10,
    name: "Premium Unisex High-Neck Fleece Sweatshirt",
    price: 42.00,
    description: "An ultra-soft unisex fleece pullover showcasing a modern high-neck collar structure. Designed to deliver superior thermal protection and long-lasting winter comfort.",
    category: "hoodies",
    variants: [
      {
        id: "v22",
        colorName: "Grey",
        images: [
          { id: "angle-10-1a", url: "/images/products/sweatshirt2-1a.webp" }
        ],
        skus: [
          { id: "s65", articleId: 65, size: "S", stock: 15 },
          { id: "s66", articleId: 66, size: "M", stock: 22 },
          { id: "s67", articleId: 67, size: "L", stock: 10 }
        ]
      },
      {
        id: "v23",
        colorName: "Red",
        images: [
          { id: "angle-10-1b", url: "/images/products/sweatshirt2-1b.webp" }
        ],
        skus: [
          { id: "s68", articleId: 68, size: "S", stock: 6 },
          { id: "s69", articleId: 69, size: "M", stock: 11 },
          { id: "s70", articleId: 70, size: "L", stock: 14 },
          { id: "s71", articleId: 71, size: "XL", stock: 4 }
        ]
      }
    ]
  }
];