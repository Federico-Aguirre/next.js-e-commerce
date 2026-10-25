import 'server-only';
import { resolveCartSku } from '@/lib/checkout/inventory';
import type { CheckoutInventoryItem } from '@/lib/checkout/inventory';
import { roundCurrencyAmount } from '@/lib/currency/currencies';
import { convertCurrencyAmount, getLatestUsdExchangeRates } from '@/lib/currency/exchange-rates';
import { amountInPaymentCurrency, loadPaymentConversion } from '@/lib/currency/payment-amount';
import type { ProviderCurrency } from '@/lib/currency/payment-amount';
import { Env } from '@/lib/Env';
import { sameDeliveryMinute } from '@/lib/orders/delivery-estimate';
import { sendOrderFulfillmentEmail } from '@/lib/orders/order-fulfillment-email';
import { prisma } from '@/lib/prisma';
import { calculateBasketTax, calculateTaxBreakdown } from '@/lib/tax/tax-calculation';
import { getCountryTaxProfile } from '@/lib/tax/tax-rates';
import { StoreConfig } from '@/utils/StoreConfig';
import { fulfillmentFromProviderStatus } from './fulfillment-status';
import { selectCheapestDeliveryQuote, selectFasterDeliveryQuote } from './select-cheapest-quote';
import type { CheckoutShippingOption, ShippingProvider, ShippingQuote } from './types';

const ZIPNOVA_API = 'https://api.zipnova.com.ar/v2';
const SHIPPO_API = 'https://api.goshippo.com';
function positiveNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DEFAULT_ITEM = {
  weight: Math.max(1, Math.round(positiveNumber(Env.DEFAULT_PACKAGE_WEIGHT_KG, 0.5) * 1000)),
  length: positiveNumber(Env.DEFAULT_PACKAGE_LENGTH_CM, 20),
  width: positiveNumber(Env.DEFAULT_PACKAGE_WIDTH_CM, 15),
  height: positiveNumber(Env.DEFAULT_PACKAGE_HEIGHT_CM, 5),
};

type OrderContext = NonNullable<Awaited<ReturnType<typeof loadOrderContext>>>;

type ShippingQuoteContext = {
  order: {
    id: string;
    total: number;
    deliveryFirstName: string | null;
    deliveryLastName: string | null;
    deliveryPhone: string | null;
    deliveryDni: string | null;
    deliveryStreet: string | null;
    deliveryNumber: string | null;
    deliveryApartment: string | null;
    deliveryCity: string | null;
    deliveryProvince: string | null;
    deliveryPostalCode: string | null;
    deliveryCountry: string | null;
    user: { email: string | null };
  };
  physicalItems: Array<{
    sku: string;
    title: string;
    quantity: number;
    price: number;
    weight: number;
    length: number;
    width: number;
    height: number;
  }>;
};

export type CheckoutShippingUser = {
  id: string;
  deliveryAddressId?: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  dni: string | null;
  shippingStreet: string | null;
  shippingNumber: string | null;
  shippingApartment: string | null;
  shippingCity: string | null;
  shippingProvince: string | null;
  shippingPostalCode: string | null;
  shippingCountry: string | null;
};

function normalizeText(value: string | null | undefined) {
  return value?.trim() || '';
}

function countryCode(value: string | null | undefined) {
  const raw = normalizeText(value);
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();

  const key = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const aliases: Record<string, string> = {
    argentina: 'AR',
    'estados unidos': 'US',
    usa: 'US',
    'united states': 'US',
    uruguay: 'UY',
    chile: 'CL',
    brasil: 'BR',
    brazil: 'BR',
    paraguay: 'PY',
    bolivia: 'BO',
    peru: 'PE',
    colombia: 'CO',
    mexico: 'MX',
    españa: 'ES',
    spain: 'ES',
    canada: 'CA',
    'reino unido': 'GB',
    'united kingdom': 'GB',
  };
  const code = aliases[key];
  if (!code) throw new Error(`País no reconocido: "${raw}". Usá el código ISO de 2 letras.`);
  return code;
}

function providerForCountry(country: string): ShippingProvider {
  return country === 'AR' ? 'ZIPNOVA' : 'SHIPPO';
}

function required(value: string | null | undefined, label: string) {
  const result = normalizeText(value);
  if (!result) throw new Error(`Falta ${label} en los datos de entrega.`);
  return result;
}

function apiError(data: unknown, fallback: string) {
  if (data && typeof data === 'object') {
    const value = data as Record<string, unknown>;
    for (const key of ['detail', 'message', 'error', 'description']) {
      if (typeof value[key] === 'string' && value[key]) return String(value[key]);
    }
  }
  return fallback;
}

async function loadOrderContext(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, items: true },
  });
  if (!order) throw new Error('Pedido inexistente.');
  if (order.status !== 'PAID') throw new Error('Solo se pueden despachar pedidos pagados.');

  const articleIds = order.items
    .map((item) => Number(item.productId))
    .filter((value) => Number.isInteger(value) && value > 0);
  const skus = await prisma.productSku.findMany({
    where: { articleId: { in: articleIds } },
    select: {
      articleId: true,
      shippingWeightGrams: true,
      shippingLengthCm: true,
      shippingWidthCm: true,
      shippingHeightCm: true,
    },
  });
  const skuMap = new Map(skus.map((sku) => [sku.articleId, sku]));

  const physicalItems = order.items.map((item) => {
    const sku = skuMap.get(Number(item.productId));
    return {
      sku: item.productId,
      title: item.title,
      quantity: item.quantity,
      price: item.price,
      weight: sku?.shippingWeightGrams ?? DEFAULT_ITEM.weight,
      length: sku?.shippingLengthCm ?? DEFAULT_ITEM.length,
      width: sku?.shippingWidthCm ?? DEFAULT_ITEM.width,
      height: sku?.shippingHeightCm ?? DEFAULT_ITEM.height,
    };
  });

  return { order, physicalItems };
}

function destination(context: ShippingQuoteContext) {
  const { order } = context;
  return {
    name: required(
      [order.deliveryFirstName, order.deliveryLastName].filter(Boolean).join(' '),
      'nombre del destinatario',
    ),
    email: required(order.user.email, 'email del destinatario'),
    phone: required(order.deliveryPhone, 'teléfono del destinatario'),
    document: normalizeText(order.deliveryDni),
    street: required(order.deliveryStreet, 'calle'),
    streetNumber: required(order.deliveryNumber, 'número de calle'),
    streetExtras: normalizeText(order.deliveryApartment),
    city: required(order.deliveryCity, 'ciudad/localidad'),
    state: required(order.deliveryProvince, 'provincia/estado'),
    zipcode: required(order.deliveryPostalCode, 'código postal'),
    country: countryCode(order.deliveryCountry),
  };
}

function normalizedComparable(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function localShippingQuotes(context: ShippingQuoteContext): ShippingQuote[] {
  const to = destination(context);
  if (to.country !== 'AR') return [];

  const quotes: ShippingQuote[] = [];
  if (Env.ENABLE_STORE_PICKUP === 'true') {
    const pickupAddress =
      normalizeText(Env.STORE_PICKUP_ADDRESS) ||
      [Env.SHIPPING_ORIGIN_STREET, Env.SHIPPING_ORIGIN_NUMBER, Env.SHIPPING_ORIGIN_CITY]
        .map(normalizeText)
        .filter(Boolean)
        .join(' ');

    quotes.push({
      id: 'local:store-pickup',
      provider: 'LOCAL',
      carrier: 'Retiro en tienda',
      service: pickupAddress ? `Retiro en ${pickupAddress}` : 'Retiro en tienda',
      amount: 0,
      currency: 'ARS',
      estimatedDeliveryAt: null,
      meta: { kind: 'pickup' },
    });
  }

  const originCity = normalizeText(Env.SHIPPING_ORIGIN_CITY);
  const isSameCity =
    originCity.length > 0 && normalizedComparable(originCity) === normalizedComparable(to.city);
  if (Env.LOCAL_FLAT_RATE_ENABLED === 'true' && isSameCity) {
    const amount = Number(Env.LOCAL_FLAT_RATE_PRICE);
    if (Number.isFinite(amount) && amount >= 0) {
      quotes.push({
        id: 'local:flat-rate',
        provider: 'LOCAL',
        carrier: 'Envío local',
        service: 'Tarifa plana local',
        amount,
        currency: 'ARS',
        estimatedDeliveryAt: null,
        meta: { kind: 'flat_rate' },
      });
    }
  }

  return quotes;
}

function aggregateParcel(context: ShippingQuoteContext) {
  const units = context.physicalItems.flatMap((item) =>
    Array.from({ length: item.quantity }, () => item),
  );
  return {
    weight: Math.max(
      1,
      units.reduce((sum, item) => sum + item.weight, 0),
    ),
    length: Math.max(...units.map((item) => item.length), DEFAULT_ITEM.length),
    width: Math.max(...units.map((item) => item.width), DEFAULT_ITEM.width),
    height: Math.max(
      DEFAULT_ITEM.height,
      units.reduce((sum, item) => sum + item.height, 0),
    ),
  };
}

function estimatedDate(days: unknown) {
  const numeric = Number(days);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return new Date(Date.now() + numeric * 86_400_000).toISOString();
}

function zipnovaAuth() {
  const token = Env.ZIPNOVA_API_TOKEN;
  const secret = Env.ZIPNOVA_API_SECRET;
  if (!token || !secret || !Env.ZIPNOVA_ACCOUNT_ID || !Env.ZIPNOVA_ORIGIN_ID) {
    throw new Error('Faltan credenciales/configuración de Zipnova en el servidor.');
  }
  return `Basic ${Buffer.from(`${token}:${secret}`).toString('base64')}`;
}

async function zipnovaOriginId() {
  const configured = normalizeText(Env.ZIPNOVA_ORIGIN_ID);
  if (/^\d+$/.test(configured)) return Number(configured);
  if (configured.toLowerCase() !== 'auto') {
    throw new Error('ZIPNOVA_ORIGIN_ID debe ser un ID numérico o "auto".');
  }

  const accountId = Number(Env.ZIPNOVA_ACCOUNT_ID);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    throw new Error('ZIPNOVA_ACCOUNT_ID debe ser un ID numérico válido.');
  }

  const response = await fetch(
    `${ZIPNOVA_API}/addresses?account_id=${encodeURIComponent(String(accountId))}`,
    {
      headers: { Authorization: zipnovaAuth(), Accept: 'application/json' },
      cache: 'no-store',
    },
  );
  const data = (await response.json()) as { data?: Array<{ id?: number }> };
  if (!response.ok) {
    throw new Error(apiError(data, `Zipnova respondió ${response.status} buscando el origen.`));
  }

  const originId = Number(data.data?.find((item) => Number.isInteger(Number(item.id)))?.id);
  if (!Number.isInteger(originId) || originId <= 0) {
    throw new Error('Zipnova no devolvió ningún origen para la cuenta configurada.');
  }
  return originId;
}

function zipnovaItems(context: ShippingQuoteContext) {
  return context.physicalItems.flatMap((item) =>
    Array.from({ length: item.quantity }, () => ({
      sku: item.sku,
      description: item.title.slice(0, 190),
      weight: item.weight,
      length: item.length,
      width: item.width,
      height: item.height,
      classification_id: 1,
    })),
  );
}

async function quoteZipnova(context: ShippingQuoteContext): Promise<ShippingQuote[]> {
  const to = destination(context);
  const response = await fetch(`${ZIPNOVA_API}/shipments/quote`, {
    method: 'POST',
    headers: { Authorization: zipnovaAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: Number(Env.ZIPNOVA_ACCOUNT_ID),
      origin_id: await zipnovaOriginId(),
      declared_value: Env.SHIPPING_MODE === 'sandbox' ? 0 : context.order.total,
      source: 'nextjs-e-commerce',
      type_packaging: 'dynamic',
      destination: { city: to.city, state: to.state, zipcode: to.zipcode, country: 'AR' },
      items: zipnovaItems(context),
    }),
    cache: 'no-store',
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(apiError(data, `Zipnova respondió ${response.status}.`));

  const rows = Array.isArray(data.results)
    ? data.results
    : Array.isArray(data.all_results)
      ? data.all_results
      : [];
  return rows
    .filter((row: any) => row.selectable !== false)
    .filter((row: any) => String(row.service_type?.code ?? row.service_type) !== 'pickup_point')
    .map((row: any) => {
      const carrierId = Number(row.carrier?.id ?? row.carrier_id);
      const serviceType = String(row.service_type?.code ?? row.service_type ?? 'standard_delivery');
      const serviceName = String(
        row.service_type?.name ?? row.service_type?.description ?? serviceType,
      );
      const logisticType = String(row.logistic_type?.code ?? row.logistic_type ?? '');
      const amount = Number(
        row.amounts?.price_incl_tax ?? row.amounts?.price ?? row.price_incl_tax ?? row.price,
      );
      return {
        id: `zipnova:${carrierId}:${logisticType}:${serviceType}`,
        provider: 'ZIPNOVA' as const,
        carrier: String(row.carrier?.name ?? `Carrier ${carrierId}`),
        service: serviceName,
        amount,
        currency: 'ARS',
        estimatedDeliveryAt: row.delivery_time?.estimated_delivery ?? null,
        meta: { carrierId, logisticType, serviceType },
      };
    })
    .filter((quote: ShippingQuote) => Number.isFinite(quote.amount))
    .sort((a: ShippingQuote, b: ShippingQuote) => a.amount - b.amount);
}

function shippoToken() {
  const token = Env.SHIPPO_API_TOKEN;
  if (!token) throw new Error('Falta SHIPPO_API_TOKEN.');
  if (Env.SHIPPING_MODE === 'sandbox' && !token.startsWith('shippo_test_')) {
    throw new Error('En sandbox, SHIPPO_API_TOKEN debe ser una clave shippo_test_.');
  }
  return token;
}

function shippoHeaders() {
  return {
    Authorization: `ShippoToken ${shippoToken()}`,
    'Content-Type': 'application/json',
    'SHIPPO-API-VERSION': '2018-02-08',
  };
}

function shippoOrigin() {
  return {
    name: required(Env.SHIPPING_ORIGIN_NAME, 'SHIPPING_ORIGIN_NAME'),
    email: required(Env.SHIPPING_ORIGIN_EMAIL, 'SHIPPING_ORIGIN_EMAIL'),
    phone: required(Env.SHIPPING_ORIGIN_PHONE, 'SHIPPING_ORIGIN_PHONE'),
    street1: `${required(Env.SHIPPING_ORIGIN_STREET, 'SHIPPING_ORIGIN_STREET')} ${required(
      Env.SHIPPING_ORIGIN_NUMBER,
      'SHIPPING_ORIGIN_NUMBER',
    )}`,
    street2:
      [
        normalizeText(Env.SHIPPING_ORIGIN_FLOOR)
          ? `Piso ${normalizeText(Env.SHIPPING_ORIGIN_FLOOR)}`
          : '',
        normalizeText(Env.SHIPPING_ORIGIN_APARTMENT)
          ? `Depto ${normalizeText(Env.SHIPPING_ORIGIN_APARTMENT)}`
          : '',
      ]
        .filter(Boolean)
        .join(' ') || undefined,
    city: required(Env.SHIPPING_ORIGIN_CITY, 'SHIPPING_ORIGIN_CITY'),
    state: required(
      Env.SHIPPING_ORIGIN_STATE_CODE || Env.SHIPPING_ORIGIN_STATE,
      'SHIPPING_ORIGIN_STATE_CODE/SHIPPING_ORIGIN_STATE',
    ),
    zip: required(Env.SHIPPING_ORIGIN_POSTAL_CODE, 'SHIPPING_ORIGIN_POSTAL_CODE'),
    country: Env.SHIPPING_ORIGIN_COUNTRY,
  };
}

function shippoCustoms(context: ShippingQuoteContext) {
  return {
    contents_type: 'MERCHANDISE',
    non_delivery_option: 'RETURN',
    certify: true,
    certify_signer: Env.SHIPPING_ORIGIN_NAME || StoreConfig.name,
    items: context.physicalItems.map((item) => ({
      description: item.title.slice(0, 100),
      quantity: item.quantity,
      net_weight: item.weight,
      mass_unit: 'g',
      value_amount: item.price.toFixed(2),
      value_currency: StoreConfig.currency,
      origin_country: Env.SHIPPING_ORIGIN_COUNTRY,
    })),
  };
}

async function quoteShippo(context: ShippingQuoteContext): Promise<ShippingQuote[]> {
  const to = destination(context);
  const parcel = aggregateParcel(context);
  const response = await fetch(`${SHIPPO_API}/shipments/`, {
    method: 'POST',
    headers: shippoHeaders(),
    body: JSON.stringify({
      address_from: shippoOrigin(),
      address_to: {
        name: to.name,
        email: to.email,
        phone: to.phone,
        street1: `${to.street} ${to.streetNumber}`,
        street2: to.streetExtras || undefined,
        city: to.city,
        state: to.state,
        zip: to.zipcode,
        country: to.country,
      },
      parcels: [
        {
          length: String(parcel.length),
          width: String(parcel.width),
          height: String(parcel.height),
          distance_unit: 'cm',
          weight: String(parcel.weight),
          mass_unit: 'g',
        },
      ],
      customs_declaration: shippoCustoms(context),
      metadata: `Order ${context.order.id}`,
      async: false,
    }),
    cache: 'no-store',
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(apiError(data, `Shippo respondió ${response.status}.`));

  const rates = Array.isArray(data.rates) ? data.rates : [];
  return rates
    .map((rate: any) => ({
      id: `shippo:${rate.object_id}`,
      provider: 'SHIPPO' as const,
      carrier: String(rate.provider ?? 'Carrier'),
      service: String(rate.servicelevel?.name ?? rate.servicelevel?.token ?? 'Service'),
      amount: Number(rate.amount),
      currency: String(rate.currency ?? 'USD'),
      estimatedDeliveryAt: estimatedDate(rate.estimated_days),
      meta: {
        rateId: String(rate.object_id),
        shipmentId: String(data.object_id ?? ''),
      },
    }))
    .filter((quote: ShippingQuote) => Number.isFinite(quote.amount))
    .sort((a: ShippingQuote, b: ShippingQuote) => a.amount - b.amount);
}

async function quoteShippingContext(context: ShippingQuoteContext) {
  const provider = providerForCountry(destination(context).country);
  const localQuotes = localShippingQuotes(context);
  let providerQuotes: ShippingQuote[] = [];

  try {
    providerQuotes =
      provider === 'ZIPNOVA' ? await quoteZipnova(context) : await quoteShippo(context);
  } catch (error) {
    if (localQuotes.length === 0) throw error;
  }

  const quotes = [...localQuotes, ...providerQuotes].sort(
    (a, b) => a.amount - b.amount || a.carrier.localeCompare(b.carrier),
  );
  if (quotes.length === 0) throw new Error(`No se obtuvieron tarifas de ${provider}.`);
  return { success: true as const, provider, quotes };
}

export async function quoteOrderShipping(orderId: string) {
  try {
    const context = await loadOrderContext(orderId);
    return await quoteShippingContext(context);
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Error de envío.',
    };
  }
}

/** Quotes shipping before the order is created, using catalog data from the database. */
export async function quoteCheckoutShipping(
  user: CheckoutShippingUser,
  cartItems: CheckoutInventoryItem[],
  paymentCurrency: ProviderCurrency,
): Promise<
  | { success: true; provider: ShippingProvider; quotes: CheckoutShippingOption[] }
  | { success: false; error: string }
> {
  try {
    const taxProfile = await getCountryTaxProfile(user.shippingCountry || 'Argentina');
    if (!taxProfile || taxProfile.status !== 'standard' || taxProfile.rate === null) {
      throw new Error(
        `No se puede confirmar el impuesto para ${user.shippingCountry || 'el destino seleccionado'}. Completá una dirección de entrega válida antes de pagar.`,
      );
    }

    const resolvedItems = await prisma.$transaction(async (tx) => {
      const grouped = new Map<
        string,
        {
          skuId: string;
          articleId: number;
          title: string;
          price: number;
          quantity: number;
          weight: number;
          length: number;
          width: number;
          height: number;
        }
      >();

      for (const item of cartItems) {
        const quantity = Number(item.quantity);
        if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 99) {
          throw new Error(`Cantidad inválida para \"${item.title}\".`);
        }
        const sku = await resolveCartSku(tx, item);
        if (!sku) {
          throw new Error(
            `No pudimos identificar el talle ${item.size || 'N/A'} de \"${item.title}\". Quitá el producto del carrito y volvé a agregarlo.`,
          );
        }
        const existing = grouped.get(sku.id);
        if (existing) {
          existing.quantity = Math.max(existing.quantity, quantity);
        } else {
          grouped.set(sku.id, {
            skuId: sku.id,
            articleId: sku.articleId,
            title: sku.variant.product.name,
            price: Number(sku.variant.product.price),
            quantity,
            weight: sku.shippingWeightGrams ?? DEFAULT_ITEM.weight,
            length: sku.shippingLengthCm ?? DEFAULT_ITEM.length,
            width: sku.shippingWidthCm ?? DEFAULT_ITEM.width,
            height: sku.shippingHeightCm ?? DEFAULT_ITEM.height,
          });
        }
      }
      return Array.from(grouped.values());
    });

    if (resolvedItems.length === 0) throw new Error('El carrito está vacío.');
    const productLines = resolvedItems.map((item) => ({
      productId: String(item.articleId),
      title: item.title,
      price: item.price,
      quantity: item.quantity,
    }));
    const basketTax = calculateBasketTax(
      productLines,
      taxProfile.rate,
      StoreConfig.currency,
      taxProfile.calculationMethod,
    );
    const paymentConversion = await loadPaymentConversion(paymentCurrency);
    const productPaymentTotal = roundCurrencyAmount(
      resolvedItems.reduce((sum, item) => {
        const grossUnitPrice = calculateTaxBreakdown(
          item.price,
          taxProfile.rate,
          StoreConfig.currency,
          taxProfile.calculationMethod,
        ).total;
        return sum + amountInPaymentCurrency(grossUnitPrice, paymentConversion) * item.quantity;
      }, 0),
      paymentCurrency,
    );

    const context: ShippingQuoteContext = {
      order: {
        id: `checkout-preview-${user.id}`,
        total: basketTax.total,
        deliveryFirstName: user.firstName,
        deliveryLastName: user.lastName,
        deliveryPhone: user.phone,
        deliveryDni: user.dni,
        deliveryStreet: user.shippingStreet,
        deliveryNumber: user.shippingNumber,
        deliveryApartment: user.shippingApartment,
        deliveryCity: user.shippingCity,
        deliveryProvince: user.shippingProvince,
        deliveryPostalCode: user.shippingPostalCode,
        deliveryCountry: user.shippingCountry,
        user: { email: user.email },
      },
      physicalItems: resolvedItems.map((item) => ({
        sku: String(item.articleId),
        title: item.title,
        quantity: item.quantity,
        price: item.price,
        weight: item.weight,
        length: item.length,
        width: item.width,
        height: item.height,
      })),
    };
    const quoteResult = await quoteShippingContext(context);
    let exchangeRates = paymentConversion.rates;
    if (
      quoteResult.quotes.some((quote) => quote.currency !== StoreConfig.currency) &&
      !exchangeRates
    ) {
      exchangeRates = (await getLatestUsdExchangeRates()).rates;
    }

    const quotes: CheckoutShippingOption[] = quoteResult.quotes.map((quote) => {
      const shippingAmount =
        quote.currency === StoreConfig.currency
          ? roundCurrencyAmount(quote.amount, StoreConfig.currency)
          : convertCurrencyAmount(
              quote.amount,
              quote.currency,
              StoreConfig.currency,
              exchangeRates!,
            );
      const paymentShippingAmount =
        quote.currency === paymentCurrency
          ? roundCurrencyAmount(quote.amount, paymentCurrency)
          : amountInPaymentCurrency(shippingAmount, paymentConversion);
      const totalInStoreCurrency = roundCurrencyAmount(
        basketTax.total + shippingAmount,
        StoreConfig.currency,
      );
      const paymentTotal = roundCurrencyAmount(
        productPaymentTotal + paymentShippingAmount,
        paymentCurrency,
      );
      return {
        ...quote,
        subtotal: basketTax.subtotal,
        taxAmount: basketTax.taxAmount,
        taxRate: taxProfile.rate!,
        taxCalculationMethod: taxProfile.calculationMethod,
        taxName: taxProfile.taxName || 'Impuesto',
        taxCountry: taxProfile.countryCode,
        productTotal: basketTax.total,
        shippingAmount,
        totalInStoreCurrency,
        paymentShippingAmount,
        paymentTotal,
        paymentCurrency,
        paymentExchangeRate: paymentConversion.exchangeRate,
        storeCurrency: StoreConfig.currency,
        quoteToken: '',
      };
    });

    // The store, not the customer, chooses the least expensive home-delivery service.
    const cheapestQuote = selectCheapestDeliveryQuote(quotes);
    if (!cheapestQuote) {
      throw new Error(
        'No hay una tarifa de entrega a domicilio disponible para esta dirección. Revisá la dirección o la configuración logística.',
      );
    }

    const fasterQuote = selectFasterDeliveryQuote(quotes, cheapestQuote);
    const checkoutQuotes: CheckoutShippingOption[] = [
      {
        ...cheapestQuote,
        meta: { ...cheapestQuote.meta, checkoutChoice: 'cheapest' },
      },
      ...(fasterQuote
        ? [
            {
              ...fasterQuote,
              meta: { ...fasterQuote.meta, checkoutChoice: 'faster' },
            },
          ]
        : []),
    ];

    return {
      success: true as const,
      provider: cheapestQuote.provider,
      quotes: checkoutQuotes,
    };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'No se pudo cotizar el envío.',
    };
  }
}

function parseMetaNumber(quote: ShippingQuote, key: string) {
  const value = Number(quote.meta[key]);
  if (!Number.isFinite(value)) throw new Error(`Cotización inválida: falta ${key}.`);
  return value;
}

function parseMetaString(quote: ShippingQuote, key: string) {
  const value = String(quote.meta[key] ?? '');
  if (!value) throw new Error(`Cotización inválida: falta ${key}.`);
  return value;
}

async function createZipnova(context: OrderContext, quote: ShippingQuote) {
  if (Env.SHIPPING_MODE === 'sandbox' && Env.ZIPNOVA_SANDBOX_ACCOUNT !== 'true') {
    throw new Error(
      'Zipnova está bloqueado para creación: confirmá una cuenta demo/sandbox con ZIPNOVA_SANDBOX_ACCOUNT=true.',
    );
  }
  const to = destination(context);
  const document = required(to.document, 'DNI/documento del destinatario');
  const response = await fetch(`${ZIPNOVA_API}/shipments`, {
    method: 'POST',
    headers: { Authorization: zipnovaAuth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      account_id: Number(Env.ZIPNOVA_ACCOUNT_ID),
      external_id: context.order.id.replaceAll('-', '').slice(0, 30),
      origin_id: await zipnovaOriginId(),
      declared_value: Env.SHIPPING_MODE === 'sandbox' ? 0 : context.order.total,
      carrier_id: parseMetaNumber(quote, 'carrierId'),
      logistic_type: parseMetaString(quote, 'logisticType'),
      service_type: parseMetaString(quote, 'serviceType'),
      source: 'nextjs-e-commerce',
      type_packaging: 'dynamic',
      process_immediately: 0,
      destination: {
        name: to.name,
        document,
        email: to.email,
        phone: to.phone,
        street: to.street,
        street_number: to.streetNumber,
        street_extras: to.streetExtras || undefined,
        city: to.city,
        state: to.state,
        zipcode: to.zipcode,
        country: 'AR',
      },
      items: zipnovaItems(context),
    }),
    cache: 'no-store',
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(apiError(data, `Zipnova respondió ${response.status}.`));

  return {
    externalId: String(data.id),
    carrier: String(data.carrier?.name ?? quote.carrier),
    service: quote.service,
    rate: Number(data.price_incl_tax ?? quote.amount),
    currency: 'ARS',
    labelUrl: null,
    trackingCode: normalizeText(data.carrier_tracking_id || data.delivery_id) || null,
    trackingUrl: normalizeText(data.tracking_external || data.tracking) || null,
    status: String(data.status ?? 'new'),
    estimatedDeliveryAt: data.delivery_time?.estimated_delivery ?? quote.estimatedDeliveryAt,
  };
}

function createLocal(context: OrderContext, quote: ShippingQuote) {
  const validQuote = localShippingQuotes(context).find((item) => item.id === quote.id);
  if (!validQuote) throw new Error('La opción de envío local ya no está disponible.');

  const kind = parseMetaString(validQuote, 'kind');
  return {
    externalId: `local:${context.order.id}`,
    carrier: validQuote.carrier,
    service: validQuote.service,
    rate: validQuote.amount,
    currency: validQuote.currency,
    labelUrl: null,
    trackingCode: null,
    trackingUrl: null,
    status: kind === 'pickup' ? 'READY_FOR_PICKUP' : 'PREPARING',
    estimatedDeliveryAt: validQuote.estimatedDeliveryAt,
  };
}

async function createShippo(context: OrderContext, quote: ShippingQuote) {
  const response = await fetch(`${SHIPPO_API}/transactions/`, {
    method: 'POST',
    headers: shippoHeaders(),
    body: JSON.stringify({
      rate: parseMetaString(quote, 'rateId'),
      async: false,
      label_file_type: 'PDF_4x6',
      metadata: `Order ${context.order.id}`,
    }),
    cache: 'no-store',
  });
  const data = (await response.json()) as any;
  if (!response.ok || data.status !== 'SUCCESS') {
    throw new Error(
      apiError(data, `Shippo no pudo crear la etiqueta (${data.status ?? response.status}).`),
    );
  }

  return {
    externalId: String(data.object_id),
    carrier: String(data.rate?.provider ?? quote.carrier),
    service: String(data.rate?.servicelevel_name ?? quote.service),
    rate: Number(data.rate?.amount ?? quote.amount),
    currency: String(data.rate?.currency ?? quote.currency),
    labelUrl: normalizeText(data.label_url) || null,
    trackingCode: normalizeText(data.tracking_number) || null,
    trackingUrl: normalizeText(data.tracking_url_provider) || null,
    status: String(data.tracking_status ?? data.status ?? 'PRE_TRANSIT'),
    estimatedDeliveryAt: normalizeText(data.eta) || quote.estimatedDeliveryAt,
  };
}

type UpdatedShippingOrder = {
  fulfillmentStatus: string;
  estimatedDeliveryAt: Date | null;
  updatedAt: Date;
};

async function notifyShippingStatusChange(
  orderId: string,
  previousStatus: string,
  previousEstimate: Date | null,
  updatedOrder: UpdatedShippingOrder,
) {
  if (updatedOrder.fulfillmentStatus === 'PREPARING' && previousStatus !== 'PREPARING') {
    await sendOrderFulfillmentEmail(orderId, 'PREPARING');
    return;
  }

  if (updatedOrder.fulfillmentStatus !== 'SHIPPED') return;
  if (previousStatus !== 'SHIPPED') {
    await sendOrderFulfillmentEmail(orderId, 'IN_TRANSIT');
    return;
  }

  if (!sameDeliveryMinute(previousEstimate, updatedOrder.estimatedDeliveryAt)) {
    await sendOrderFulfillmentEmail(orderId, 'DELIVERY_ESTIMATE_UPDATED', {
      eventVersion: updatedOrder.updatedAt.getTime(),
      previousEstimatedDeliveryAt: previousEstimate,
    });
  }
}

export async function createOrderShipping(orderId: string, quote: ShippingQuote) {
  let claimAcquired = false;
  let remoteRequestStarted = false;
  let providerCreated = false;
  let previousShippingStatus: string | null = null;

  try {
    const context = await loadOrderContext(orderId);
    if (context.order.shippingExternalId) throw new Error('El pedido ya tiene un envío creado.');
    if (context.order.shippingStatus === 'CREATING') {
      throw new Error(
        'La creación anterior sigue sin resolverse. Revisá el proveedor antes de reintentar.',
      );
    }
    const expectedProvider = providerForCountry(destination(context).country);
    if (quote.provider !== 'LOCAL' && quote.provider !== expectedProvider) {
      throw new Error('Proveedor de envío inválido para el destino.');
    }

    previousShippingStatus = context.order.shippingStatus;
    const claim = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PAID',
        shippingExternalId: null,
        shippingStatus: previousShippingStatus,
      },
      data: { shippingStatus: 'CREATING', shippingError: null },
    });
    if (claim.count !== 1) {
      throw new Error('Ya hay una creación de envío en curso o el pedido cambió de estado.');
    }
    claimAcquired = true;

    remoteRequestStarted = quote.provider !== 'LOCAL';
    const created =
      quote.provider === 'LOCAL'
        ? createLocal(context, quote)
        : quote.provider === 'ZIPNOVA'
          ? await createZipnova(context, quote)
          : await createShippo(context, quote);
    providerCreated = quote.provider !== 'LOCAL';

    if (!created.externalId || created.externalId === 'undefined') {
      throw new Error('El proveedor no devolvió un identificador de envío válido.');
    }

    const estimatedDeliveryAt = created.estimatedDeliveryAt
      ? new Date(created.estimatedDeliveryAt)
      : null;
    const providerFulfillmentStatus = fulfillmentFromProviderStatus(created.status);
    const estimatedForDelivery =
      estimatedDeliveryAt && !Number.isNaN(estimatedDeliveryAt.getTime())
        ? estimatedDeliveryAt
        : null;
    const saved = await prisma.order.updateMany({
      where: {
        id: orderId,
        status: 'PAID',
        shippingExternalId: null,
        shippingStatus: 'CREATING',
      },
      data: {
        shippingProvider: quote.provider,
        shippingMode: Env.SHIPPING_MODE,
        shippingExternalId: created.externalId,
        shippingCarrier: created.carrier,
        shippingService: created.service,
        shippingRate: Number.isFinite(created.rate) ? created.rate : quote.amount,
        shippingCurrency: created.currency,
        shippingLabelUrl: created.labelUrl,
        shippingTrackingUrl: created.trackingUrl,
        shippingStatus: created.status,
        shippingError: null,
        trackingCode: created.trackingCode,
        estimatedDeliveryAt: estimatedForDelivery,
        fulfillmentStatus:
          providerFulfillmentStatus === 'SHIPPED' &&
          (!estimatedForDelivery || estimatedForDelivery.getTime() <= Date.now())
            ? context.order.fulfillmentStatus
            : providerFulfillmentStatus,
      },
    });
    if (saved.count !== 1) {
      throw new Error(
        'El proveedor creó el envío, pero no se pudo vincular al pedido. Revisá el proveedor antes de reintentar.',
      );
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: { fulfillmentStatus: true, estimatedDeliveryAt: true, updatedAt: true },
    });
    if (!updatedOrder) throw new Error('No se pudo recuperar el pedido después de crear el envío.');

    await notifyShippingStatusChange(
      orderId,
      context.order.fulfillmentStatus,
      context.order.estimatedDeliveryAt,
      updatedOrder,
    );
    return { success: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el envío.';
    const providerOutcomeUnknown =
      remoteRequestStarted &&
      (error instanceof TypeError ||
        /fetch failed|timeout|socket|ECONNRESET|ETIMEDOUT|EAI_AGAIN|\b5\d{2}\b/i.test(message));
    if (claimAcquired) {
      await prisma.order
        .updateMany({
          where: {
            id: orderId,
            status: 'PAID',
            shippingExternalId: null,
            shippingStatus: 'CREATING',
          },
          data:
            providerCreated || providerOutcomeUnknown
              ? { shippingError: message }
              : { shippingStatus: previousShippingStatus, shippingError: message },
        })
        .catch(() => undefined);
    }
    return { success: false as const, error: message };
  }
}

async function refreshShippo(externalId: string) {
  const response = await fetch(`${SHIPPO_API}/transactions/${encodeURIComponent(externalId)}`, {
    headers: shippoHeaders(),
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(apiError(data, `Shippo respondió ${response.status}.`));
  return {
    status: String(data.tracking_status ?? data.status ?? 'UNKNOWN'),
    trackingCode: normalizeText(data.tracking_number) || null,
    trackingUrl: normalizeText(data.tracking_url_provider) || null,
    labelUrl: normalizeText(data.label_url) || null,
    estimatedDeliveryAt: normalizeText(data.eta) || null,
  };
}

async function refreshZipnova(externalId: string) {
  const response = await fetch(`${ZIPNOVA_API}/shipments/${encodeURIComponent(externalId)}`, {
    headers: { Authorization: zipnovaAuth(), Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(8_000),
  });
  const data = (await response.json()) as any;
  if (!response.ok) throw new Error(apiError(data, `Zipnova respondió ${response.status}.`));
  return {
    status: String(data.status ?? 'new'),
    trackingCode: normalizeText(data.carrier_tracking_id || data.delivery_id) || null,
    trackingUrl: normalizeText(data.tracking_external || data.tracking) || null,
    labelUrl: null,
    estimatedDeliveryAt: normalizeText(data.delivery_time?.estimated_delivery) || null,
  };
}

export async function refreshOrderShipping(orderId: string) {
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order?.shippingExternalId || !order.shippingProvider) {
      throw new Error('El pedido todavía no tiene un envío vinculado.');
    }
    const provider = order.shippingProvider as ShippingProvider;
    if (provider === 'LOCAL') {
      return { success: true as const };
    }
    const refreshed =
      provider === 'SHIPPO'
        ? await refreshShippo(order.shippingExternalId)
        : await refreshZipnova(order.shippingExternalId);
    const eta = refreshed.estimatedDeliveryAt ? new Date(refreshed.estimatedDeliveryAt) : null;
    const estimatedForDelivery =
      eta && !Number.isNaN(eta.getTime()) ? eta : order.estimatedDeliveryAt;
    const providerFulfillmentStatus = fulfillmentFromProviderStatus(refreshed.status);
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        shippingStatus: refreshed.status,
        shippingTrackingUrl: refreshed.trackingUrl,
        shippingLabelUrl: refreshed.labelUrl ?? order.shippingLabelUrl,
        trackingCode: refreshed.trackingCode ?? order.trackingCode,
        estimatedDeliveryAt: estimatedForDelivery,
        fulfillmentStatus:
          providerFulfillmentStatus === 'SHIPPED' &&
          (!estimatedForDelivery || estimatedForDelivery.getTime() <= Date.now())
            ? order.fulfillmentStatus
            : providerFulfillmentStatus,
        shippingError: null,
      },
      select: { fulfillmentStatus: true, estimatedDeliveryAt: true, updatedAt: true },
    });
    await notifyShippingStatusChange(
      orderId,
      order.fulfillmentStatus,
      order.estimatedDeliveryAt,
      updatedOrder,
    );
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'No se pudo actualizar el tracking.',
    };
  }
}
