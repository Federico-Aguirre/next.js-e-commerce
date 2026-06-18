export interface ProductImage {
  id: string;      // Identificador de la foto (ej: "front", "side", "back")
  url: string;     // La ruta de la imagen optimizada (.src)
}

export interface ProductVariant {
  colorName: string;         // Nombre del color (ej: "Triple White", "Core Black")
  colorHex: string;          // Código de color CSS para pintar los botoncitos (ej: "#FFFFFF", "#000000")
  images: ProductImage[];    // Array con las múltiples fotos de ESTE color específico
}

export interface Product {
  id: number;
  title: string;
  price: number;
  description: string;
  category: string;
  image: string;             // Imagen principal por defecto para la grilla general
  variants?: ProductVariant[]; // Opcional: Variantes de color y fotos para la página de detalle
}