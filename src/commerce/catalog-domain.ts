import type {
  CatalogSort as ContractCatalogSort,
  Money,
  Pagination,
  Product,
  ProductId,
  ProductVariant,
} from './contracts';

export type CatalogCategory = {
  id: string;
  slug: string;
  name: string;
  parentId?: string;
};

export type CatalogCollection = {
  id: string;
  slug: string;
  name: string;
};

export type CatalogMedia = {
  id: string;
  kind: 'image' | 'video';
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  position: number;
};

export type CatalogOption = {
  id: string;
  name: string;
  values: readonly string[];
};

export type CatalogInventory = {
  availableQuantity: number;
  reservedQuantity: number;
};

export type CatalogVariant = ProductVariant & {
  optionValues: Readonly<Record<string, string>>;
  compareAtPrice?: Money;
  inventory: CatalogInventory;
  media: readonly CatalogMedia[];
  sizeStock?: Readonly<Record<string, { articleId: number; stock: number }>>;
};

export type CatalogProduct = Omit<Product, 'variants'> & {
  status: 'draft' | 'active' | 'archived';
  gender?: 'Men' | 'Women' | 'Unisex' | 'none';
  material?: string;
  brand?: string;
  sku?: string;
  rating?: number;
  discount?: number;
  categories: readonly CatalogCategory[];
  collections: readonly CatalogCollection[];
  media: readonly CatalogMedia[];
  options: readonly CatalogOption[];
  variants: readonly CatalogVariant[];
};

export type CatalogFilterOptions = {
  colors: readonly { id: string; name: string }[];
  sizes: readonly string[];
  brands: readonly string[];
  genders: readonly string[];
  materials: readonly string[];
};

export type CatalogFacet = {
  key: string;
  values: readonly {
    value: string;
    count: number;
  }[];
};

export type CatalogSort = ContractCatalogSort;

export type CatalogPagination = Pagination;
export type CatalogBrowseFilters = {
  categoryIds?: readonly string[];
  collectionIds?: readonly string[];
  optionValues?: Readonly<Record<string, readonly string[]>>;
  price?: {
    min?: number;
    max?: number;
  };
  availability?: 'in-stock' | 'all';
};

export type CatalogBrowseQuery = {
  query?: string;
  marketId?: string;
  filters?: CatalogBrowseFilters;
  facets?: readonly string[];
  sort?: CatalogSort;
  pagination: CatalogPagination;
};

export type CatalogPageInfo = CatalogPagination & {
  total: number;
  pageCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type CatalogPage = {
  products: readonly CatalogProduct[];
  pageInfo: CatalogPageInfo;
  facets: readonly CatalogFacet[];
};

export type CatalogDomainRepository = {
  getProductById: (productId: ProductId) => Promise<CatalogProduct | null>;
  getProductBySlug: (slug: string) => Promise<CatalogProduct | null>;
  listProducts: (query: CatalogBrowseQuery) => Promise<CatalogPage>;
};
