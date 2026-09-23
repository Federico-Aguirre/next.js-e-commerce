/**
 * Provider-neutral commerce ports.
 *
 * These contracts keep storefront/domain code independent from a concrete
 * commerce backend, payment processor, shipping service, tax engine, search
 * engine, or session implementation.
 */

export type CurrencyCode = string;
export type CustomerId = string;
export type ProductId = string;
export type VariantId = string;
export type CartId = string;
export type OrderId = string;
export type AddressId = string;
export type CheckoutSessionId = string;

export type Money = {
  amount: number;
  currency: CurrencyCode;
};

export type ProductVariant = {
  id: VariantId;
  productId: ProductId;
  sku: string;
  name: string;
  price: Money;
  available: boolean;
};

export type Product = {
  id: ProductId;
  slug: string;
  name: string;
  description: string;
  variants: readonly ProductVariant[];
};

export type PriceFilter = {
  min?: number;
  max?: number;
};

export type CatalogSort = {
  field: 'relevance' | 'price' | 'name' | 'createdAt';
  direction: 'asc' | 'desc';
};

export type Pagination = {
  page: number;
  pageSize: number;
};

export type CatalogFilters = {
  optionValues?: Record<string, readonly string[]>;
  price?: PriceFilter;
};

export type CatalogQuery = {
  query?: string;
  category?: string;
  filters?: CatalogFilters;
  sort?: CatalogSort;
  pagination?: Pagination;
  limit?: number;
  offset?: number;
};

export type CatalogResult = {
  products: readonly Product[];
  total: number;
};

export type CartLine = {
  lineId: string;
  variantId: VariantId;
  quantity: number;
  unitPrice: Money;
};

export type Cart = {
  id: CartId;
  customerId?: CustomerId;
  marketId?: string;
  currency: CurrencyCode;
  status?: 'active' | 'completed' | 'abandoned';
  appliedPromotionCodes?: readonly string[];
  lines: readonly CartLine[];
};

export type Address = {
  id: AddressId;
  customerId?: CustomerId;
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
};

export type ShippingOption = {
  id: string;
  name: string;
  amount: Money;
  estimatedDays?: number;
};

export type TaxLine = {
  name: string;
  amount: Money;
  rate?: number;
};

export type OrderStatus = 'pending' | 'confirmed' | 'fulfilled' | 'cancelled';

export type Order = {
  id: OrderId;
  customerId?: CustomerId;
  cartId: CartId;
  currency: CurrencyCode;
  subtotal: Money;
  shipping: Money;
  tax: Money;
  discount: Money;
  total: Money;
  status: OrderStatus;
  idempotencyKey?: string;
};

export type IdempotencyStore = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown) => Promise<void>;
};

export type CheckoutSession = {
  id: CheckoutSessionId;
  cartId: CartId;
  customerId?: CustomerId;
  shippingAddress?: Address;
  shippingOption?: ShippingOption;
  taxLines: readonly TaxLine[];
  discount: Money;
  currency: CurrencyCode;
};

export type PaymentRequest = {
  orderId: OrderId;
  amount: Money;
  idempotencyKey: string;
};

export type PaymentStatus =
  | 'pending'
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'cancelled';

export type PaymentResult = {
  status: PaymentStatus;
  providerReference?: string;
};

export type SearchQuery = Omit<CatalogQuery, 'query'> & {
  query: string;
};

export type SearchResult = CatalogResult;

export type SessionUser = {
  id: CustomerId;
  email: string;
  name?: string;
};

export type CommerceRepository = {
  getProduct: (productId: ProductId) => Promise<Product | null>;
  getProductBySlug: (slug: string) => Promise<Product | null>;
  listProducts: (query: CatalogQuery) => Promise<CatalogResult>;
  getCart: (cartId: CartId) => Promise<Cart | null>;
  saveCart: (cart: Cart) => Promise<void>;
  getCustomerAddresses: (customerId: CustomerId) => Promise<readonly Address[]>;
  saveAddress: (address: Address) => Promise<void>;
  getOrder: (orderId: OrderId) => Promise<Order | null>;
  saveOrder: (order: Order) => Promise<void>;
};

export type PaymentGateway = {
  authorize: (request: PaymentRequest) => Promise<PaymentResult>;
  capture: (request: PaymentRequest) => Promise<PaymentResult>;
  cancel: (request: PaymentRequest) => Promise<PaymentResult>;
};

export type ShippingGateway = {
  listOptions: (input: {
    cart: Cart;
    address: Address;
  }) => Promise<readonly ShippingOption[]>;
};

export type TaxGateway = {
  calculate: (input: {
    cart: Cart;
    shipping: Money;
    address: Address;
  }) => Promise<readonly TaxLine[]>;
};

export type SearchProvider = {
  search: (query: SearchQuery) => Promise<SearchResult>;
};

export type SessionAuth = {
  getCurrentUser: () => Promise<SessionUser | null>;
  requireCurrentUser: () => Promise<SessionUser>;
};

export type CheckoutRepository = {
  getSession: (sessionId: CheckoutSessionId) => Promise<CheckoutSession | null>;
  saveSession: (session: CheckoutSession) => Promise<void>;
};

export type CheckoutService = {
  createSession: (
    cartId: CartId,
    customerId?: CustomerId,
  ) => Promise<CheckoutSession>;
  refreshTotals: (sessionId: CheckoutSessionId) => Promise<CheckoutSession>;
  placeOrder: (
    sessionId: CheckoutSessionId,
    idempotencyKey: string,
  ) => Promise<Order>;
};

export type CacheStrategy = {
  invalidate: (tags: readonly string[]) => Promise<void>;
  revalidate: (tags: readonly string[]) => Promise<void>;
};
