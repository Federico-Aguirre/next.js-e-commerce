import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { Env } from '@/lib/Env';
import { reconcilePendingPayPalConnection } from '@/lib/payments/paypal-onboarding-status';
import { reconcilePendingStripeConnection } from '@/lib/payments/stripe-onboarding-status';
import { prisma } from '@/lib/prisma';
import { StoreConfig } from '@/utils/StoreConfig';
import type { DashboardData, FulfillmentStatus } from './types';

function currentBuenosAiresMonthRange(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === 'year')?.value);
  const month = Number(parts.find((part) => part.type === 'month')?.value);

  return {
    start: new Date(Date.UTC(year, month - 1, 1, 3, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 3, 0, 0, 0)),
  };
}

function normalizeFulfillmentStatus(value: string): FulfillmentStatus {
  if (
    value === 'PREPARING' ||
    value === 'SHIPPED' ||
    value === 'DELIVERED' ||
    value === 'CANCELLED'
  ) {
    return value;
  }

  return 'PENDING';
}

export async function getDashboardAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user) return null;

  const dbUser = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isAdmin: true },
      })
    : session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { isAdmin: true },
        })
      : null;

  return dbUser?.isAdmin ? session : null;
}

export async function requireDashboardAdmin() {
  const session = await getDashboardAdmin();

  if (!session) throw new Error('FORBIDDEN');

  return session;
}

export async function getPlatformOwner() {
  const session = await getServerSession(authOptions);

  if (!session?.user) return null;

  const dbUser = session.user.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { isPlatformOwner: true },
      })
    : session.user.email
      ? await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { isPlatformOwner: true },
        })
      : null;

  return dbUser?.isPlatformOwner ? session : null;
}

export async function requirePlatformOwner() {
  const session = await getPlatformOwner();

  if (!session) throw new Error('FORBIDDEN_PLATFORM_OWNER');

  return session;
}

export async function getDashboardData(includePaymentConnections = false): Promise<DashboardData> {
  if (includePaymentConnections) {
    await Promise.all([reconcilePendingPayPalConnection(), reconcilePendingStripeConnection()]);
  }

  const monthRange = currentBuenosAiresMonthRange();
  const [sales, paidOrderCount, recentOrders, catalogRows, cartUsers, monthlyCompleted] =
    await Promise.all([
      prisma.order.aggregate({
        where: { status: 'PAID', currency: StoreConfig.currency },
        _count: { id: true },
        _sum: { total: true },
      }),
      prisma.order.count({ where: { status: 'PAID' } }),
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          total: true,
          currency: true,
          paymentCurrency: true,
          paymentTotal: true,
          paymentExchangeRate: true,
          createdAt: true,
          updatedAt: true,
          status: true,
          paymentProvider: true,
          fulfillmentStatus: true,
          trackingCode: true,
          estimatedDeliveryAt: true,
          shippingProvider: true,
          shippingMode: true,
          shippingExternalId: true,
          shippingCarrier: true,
          shippingService: true,
          shippingRate: true,
          shippingCurrency: true,
          shippingLabelUrl: true,
          shippingTrackingUrl: true,
          shippingStatus: true,
          shippingError: true,
          deliveryFirstName: true,
          deliveryLastName: true,
          deliveryPhone: true,
          deliveryDni: true,
          deliveryStreet: true,
          deliveryNumber: true,
          deliveryApartment: true,
          deliveryCity: true,
          deliveryProvince: true,
          deliveryPostalCode: true,
          deliveryCountry: true,
          user: {
            select: {
              name: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              dni: true,
              shippingStreet: true,
              shippingNumber: true,
              shippingApartment: true,
              shippingCity: true,
              shippingProvince: true,
              shippingPostalCode: true,
              shippingCountry: true,
            },
          },
        },
      }),
      prisma.productSku.findMany({
        orderBy: { articleId: 'asc' },
        select: {
          id: true,
          articleId: true,
          size: true,
          stock: true,
          lowStockAlertSent: true,
          lowStockAlertedAt: true,
          variant: {
            select: {
              colorName: true,
              product: { select: { id: true, name: true, price: true, isActive: true } },
            },
          },
        },
      }),
      prisma.cartItem.groupBy({ by: ['userId'] }),
      prisma.order.aggregate({
        where: {
          status: 'PAID',
          currency: StoreConfig.currency,
          fulfillmentStatus: 'DELIVERED',
          deliveredAt: { gte: monthRange.start, lt: monthRange.end },
        },
        _sum: { total: true, subtotal: true },
        _count: { id: true },
      }),
    ]);

  const [
    visitCount,
    deviceRows,
    topRows,
    subscription,
    inventoryAlertSettings,
    paymentConnectionRows,
  ] = await Promise.all([
    prisma.analyticsVisit.count(),
    prisma.analyticsVisit.groupBy({
      by: ['device'],
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ['title', 'price'],
      where: { order: { status: 'PAID', currency: StoreConfig.currency } },
      _sum: { quantity: true },
    }),
    prisma.storeSubscription.findUnique({ where: { id: 'default' } }),
    prisma.inventoryAlertSettings.findUnique({ where: { id: 'default' } }),
    includePaymentConnections
      ? prisma.storePaymentConnection.findMany({
          select: { provider: true, status: true, metadata: true },
        })
      : Promise.resolve([]),
  ]);

  const salesTotal = sales._sum.total ?? 0;
  const paidOrderCountInStoreCurrency = sales._count.id;
  const conversionRate = visitCount > 0 ? (paidOrderCount / visitCount) * 100 : 0;
  const averageTicket =
    paidOrderCountInStoreCurrency > 0 ? salesTotal / paidOrderCountInStoreCurrency : 0;
  const commissionPercent = subscription?.commissionPercent ?? 10;
  const monthlyCompletedRevenue = monthlyCompleted._sum.total ?? 0;
  const commissionableMonthlySubtotal = monthlyCompleted._sum.subtotal ?? monthlyCompletedRevenue;

  const productTotals = new Map<string, { title: string; quantity: number; revenue: number }>();

  for (const row of topRows) {
    const quantity = row._sum.quantity ?? 0;
    const current = productTotals.get(row.title) ?? {
      title: row.title,
      quantity: 0,
      revenue: 0,
    };

    current.quantity += quantity;
    current.revenue += row.price * quantity;
    productTotals.set(row.title, current);
  }

  const topProducts = [...productTotals.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const devices = deviceRows.reduce(
    (acc, row) => {
      if (row.device === 'mobile') acc.mobile = row._count._all;
      if (row.device === 'desktop') acc.desktop = row._count._all;
      return acc;
    },
    { mobile: 0, desktop: 0 },
  );

  const allCatalogControls = catalogRows
    .map((row) => ({
      productId: row.variant.product.id,
      productName: row.variant.product.name,
      productPrice: row.variant.product.price,
      isActive: row.variant.product.isActive,
      skuId: row.id,
      sku: row.articleId,
      size: row.size,
      colorName: row.variant.colorName,
      stock: row.stock,
      lowStockAlertSent: row.lowStockAlertSent,
      lowStockAlertedAt: row.lowStockAlertedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => {
      const byName = a.productName.localeCompare(b.productName, undefined, {
        sensitivity: 'base',
      });

      if (byName !== 0) return byName;
      if (a.colorName !== b.colorName) return a.colorName.localeCompare(b.colorName);
      return a.size.localeCompare(b.size, undefined, { numeric: true });
    });

  const catalogControls = allCatalogControls;
  const inventoryAlert = {
    enabled: inventoryAlertSettings?.enabled ?? false,
    threshold: inventoryAlertSettings?.threshold ?? 5,
    telegramConfigured: Boolean(Env.TELEGRAM_BOT_TOKEN && Env.TELEGRAM_CHAT_ID),
  };
  const paymentConnectionStatus = Object.fromEntries(
    paymentConnectionRows.map((row) => [row.provider, row.status]),
  ) as Record<string, string>;
  const stripeConnection = paymentConnectionRows.find((row) => row.provider === 'STRIPE');
  const stripeMetadata =
    stripeConnection?.metadata &&
    typeof stripeConnection.metadata === 'object' &&
    !Array.isArray(stripeConnection.metadata)
      ? stripeConnection.metadata
      : null;
  const stripeError =
    stripeMetadata && typeof stripeMetadata.message === 'string' ? stripeMetadata.message : null;

  return {
    salesTotal,
    paidOrderCount,
    visits: visitCount,
    conversionRate,
    averageTicket,
    abandonedCarts: cartUsers.length,
    commissionPercent,
    monthlyCompletedRevenue,
    commissionAmount: commissionableMonthlySubtotal * (commissionPercent / 100),
    devices,
    topProducts,
    catalogControls,
    inventoryAlert,
    paymentConnections: {
      mercadoPago: paymentConnectionStatus.MERCADOPAGO ?? null,
      paypal: paymentConnectionStatus.PAYPAL ?? null,
      stripe: paymentConnectionStatus.STRIPE ?? null,
      stripeError,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      paymentCurrency: order.paymentCurrency,
      paymentTotal: order.paymentTotal,
      paymentExchangeRate: order.paymentExchangeRate,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      customer: order.user.name || order.user.email || null,
      delivery: {
        firstName: order.deliveryFirstName ?? order.user.firstName,
        lastName: order.deliveryLastName ?? order.user.lastName,
        email: order.user.email,
        phone: order.deliveryPhone ?? order.user.phone,
        dni: order.deliveryDni ?? order.user.dni,
        street: order.deliveryStreet ?? order.user.shippingStreet,
        number: order.deliveryNumber ?? order.user.shippingNumber,
        apartment: order.deliveryApartment ?? order.user.shippingApartment,
        city: order.deliveryCity ?? order.user.shippingCity,
        province: order.deliveryProvince ?? order.user.shippingProvince,
        postalCode: order.deliveryPostalCode ?? order.user.shippingPostalCode,
        country: order.deliveryCountry ?? order.user.shippingCountry,
      },
      paymentStatus: order.status,
      paymentProvider: order.paymentProvider,
      fulfillmentStatus: normalizeFulfillmentStatus(order.fulfillmentStatus || 'PENDING'),
      trackingCode: order.trackingCode,
      estimatedDeliveryAt: order.estimatedDeliveryAt?.toISOString() ?? null,
      shipping: {
        provider: order.shippingProvider,
        mode: order.shippingMode,
        externalId: order.shippingExternalId,
        carrier: order.shippingCarrier,
        service: order.shippingService,
        rate: order.shippingRate,
        currency: order.shippingCurrency,
        labelUrl: order.shippingLabelUrl,
        trackingUrl: order.shippingTrackingUrl,
        status: order.shippingStatus,
        error: order.shippingError,
      },
    })),
    subscription: subscription
      ? {
          status: subscription.status,
          nextPaymentAt: subscription.nextPaymentAt?.toISOString() ?? null,
          commissionPercent: subscription.commissionPercent,
        }
      : null,
  };
}
