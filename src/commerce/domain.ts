export type {
  CatalogBrowseFilters,
  CatalogBrowseQuery,
  CatalogCategory,
  CatalogCollection,
  CatalogDomainRepository,
  CatalogFacet,
  CatalogInventory,
  CatalogMedia,
  CatalogOption,
  CatalogPage,
  CatalogPageInfo,
  CatalogPagination,
  CatalogProduct,
  CatalogSort,
  CatalogVariant,
} from './catalog-domain';

export type { CurrencyDefinition, Market, MarketRepository } from './market';
export type {
  CustomerAddress,
  CustomerProfile,
  CustomerRepository,
} from './customer';
export type {
  Promotion,
  PromotionApplication,
  PromotionRepository,
} from './promotion';
export { calculatePromotionDiscount } from './promotion';
