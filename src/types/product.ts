// src/types/product.ts

export interface VariantImage {
  id: string;      // UUID generado por la base de datos
  url: string;     // Ruta de la imagen (ej: "/_next/static/media/jacket1-1a.webp")
}

export interface ProductSku {
  id: string;      // UUID del SKU
  articleId: number; // ID único universal por combinación talle/color
  size: string;    // El talle (ej: "S", "M", "8", "9")
  stock: number;   // El stock real en base de datos (ej: 0, 1, 15)
}

export interface ProductVariant {
  id: string;
  colorName: string;         // Nombre del color (ej: "Black/City Grey")
  images: VariantImage[];    // Array con las múltiples fotos (ángulos) de ESTE color específico
  skus: ProductSku[];        // Array de objetos con el talle y su stock real
}

export interface Product {
  id: number;
  name: string;              // Cambiado de 'title' a 'name' para mappear con Postgres
  price: number;
  description: string;
  category: string;
  variants: ProductVariant[]; // Ya no es opcional, siempre viene la estructura relacional
}