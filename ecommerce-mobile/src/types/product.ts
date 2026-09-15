export interface VariantImage {
  id: string;
  url: string;
}

export interface ProductSku {
  id: string;
  articleId: number;
  size: string;
  stock: number;
}

export interface ProductVariant {
  id: string;
  colorName: string;
  images: VariantImage[];
  skus: ProductSku[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  category: string;
  variants: ProductVariant[];
}