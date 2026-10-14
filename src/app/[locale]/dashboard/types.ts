export type FulfillmentStatus = 'PENDING' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export type DashboardOrder = {
  id: string;
  orderNumber: number;
  total: number;
  createdAt: string;
  customer: string | null;
  delivery: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    dni: string | null;
    street: string | null;
    number: string | null;
    apartment: string | null;
    city: string | null;
    province: string | null;
    postalCode: string | null;
    country: string | null;
  };
  paymentStatus: string;
  paymentProvider: string | null;
  fulfillmentStatus: FulfillmentStatus;
  trackingCode: string | null;
  estimatedDeliveryAt: string | null;
  shipping: {
    provider: string | null;
    mode: string | null;
    externalId: string | null;
    carrier: string | null;
    service: string | null;
    rate: number | null;
    currency: string | null;
    labelUrl: string | null;
    trackingUrl: string | null;
    status: string | null;
    error: string | null;
  };
};

export type DashboardData = {
  salesTotal: number;
  paidOrderCount: number;
  visits: number;
  conversionRate: number;
  averageTicket: number;
  abandonedCarts: number;
  commissionPercent: number;
  monthlyCompletedRevenue: number;
  commissionAmount: number;
  devices: {
    mobile: number;
    desktop: number;
  };
  topProducts: Array<{
    title: string;
    quantity: number;
    revenue: number;
  }>;
  catalogControls: Array<{
    productId: number;
    productName: string;
    productPrice: number;
    isActive: boolean;
    skuId: string;
    sku: number;
    size: string;
    colorName: string;
    stock: number;
    lowStockAlertSent: boolean;
    lowStockAlertedAt: string | null;
  }>;
  inventoryAlert: {
    enabled: boolean;
    threshold: number;
    telegramConfigured: boolean;
  };
  recentOrders: DashboardOrder[];
  subscription: {
    status: string;
    nextPaymentAt: string | null;
    commissionPercent: number;
  } | null;
};
