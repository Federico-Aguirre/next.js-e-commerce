import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CheckoutInventoryItem } from '@/lib/checkout/inventory';
import type { CheckoutShippingUser } from './order-shipping';
import type { CheckoutShippingOption } from './types';

const QUOTE_TTL_MS = 15 * 60 * 1000;

type QuoteUser = Pick<
  CheckoutShippingUser,
  | 'id'
  | 'deliveryAddressId'
  | 'shippingStreet'
  | 'shippingNumber'
  | 'shippingApartment'
  | 'shippingCity'
  | 'shippingProvince'
  | 'shippingPostalCode'
  | 'shippingCountry'
>;

type SignedQuote = {
  version: 3;
  userId: string;
  cartFingerprint: string;
  addressFingerprint: string;
  expiresAt: number;
  quote: Omit<CheckoutShippingOption, 'quoteToken'>;
};

function secret() {
  const value = process.env.NEXTAUTH_SECRET?.trim();
  if (!value || value.length < 16) {
    throw new Error(
      'NEXTAUTH_SECRET debe tener al menos 16 caracteres para firmar la cotización de envío.',
    );
  }
  return value;
}

function asText(value: string | number | undefined | null) {
  return value == null ? '' : String(value).trim();
}

export function checkoutCartFingerprint(items: CheckoutInventoryItem[]) {
  const canonical = items
    .map((item) => ({
      id: asText(item.id),
      productId: asText(item.productId),
      articleId: asText(item.articleId),
      variantId: asText(item.variantId),
      colorName: asText(item.colorName).toLocaleLowerCase('es-AR'),
      title: asText(item.title).toLocaleLowerCase('es-AR'),
      quantity: Number(item.quantity),
      size: asText(item.size).toLocaleUpperCase('es-AR'),
    }))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return createHmac('sha256', secret()).update(JSON.stringify(canonical)).digest('hex');
}

function checkoutAddressFingerprint(user: QuoteUser) {
  const address = [
    user.deliveryAddressId,
    user.shippingStreet,
    user.shippingNumber,
    user.shippingApartment,
    user.shippingCity,
    user.shippingProvince,
    user.shippingPostalCode,
    user.shippingCountry,
  ].map((value) => asText(value).toLocaleLowerCase('es-AR'));
  return createHmac('sha256', secret()).update(JSON.stringify(address)).digest('hex');
}

function sign(encodedPayload: string) {
  return createHmac('sha256', secret()).update(encodedPayload).digest('base64url');
}

export function createCheckoutQuoteToken(
  user: QuoteUser,
  items: CheckoutInventoryItem[],
  quote: CheckoutShippingOption,
) {
  const { quoteToken: omittedToken, ...quoteData } = quote;
  void omittedToken;
  const payload: SignedQuote = {
    version: 3,
    userId: user.id,
    cartFingerprint: checkoutCartFingerprint(items),
    addressFingerprint: checkoutAddressFingerprint(user),
    expiresAt: Date.now() + QUOTE_TTL_MS,
    quote: quoteData,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function isValidQuote(value: unknown): value is SignedQuote['quote'] {
  if (!value || typeof value !== 'object') return false;
  const quote = value as Record<string, unknown>;
  return (
    typeof quote.id === 'string' &&
    ['ZIPNOVA', 'SHIPPO', 'LOCAL'].includes(String(quote.provider)) &&
    typeof quote.carrier === 'string' &&
    typeof quote.service === 'string' &&
    typeof quote.currency === 'string' &&
    typeof quote.paymentCurrency === 'string' &&
    ['ARS', 'USD'].includes(String(quote.paymentCurrency)) &&
    Number.isFinite(quote.amount) &&
    Number(quote.amount) >= 0 &&
    Number.isFinite(quote.shippingAmount) &&
    Number(quote.shippingAmount) >= 0 &&
    Number.isFinite(quote.totalInStoreCurrency) &&
    Number(quote.totalInStoreCurrency) >= 0 &&
    Number.isFinite(quote.paymentTotal) &&
    Number(quote.paymentTotal) >= 0 &&
    Number.isFinite(quote.paymentExchangeRate) &&
    Number(quote.paymentExchangeRate) > 0 &&
    Number.isFinite(quote.productTotal) &&
    Number(quote.productTotal) >= 0 &&
    Number.isFinite(quote.taxRate) &&
    Number(quote.taxRate) >= 0 &&
    typeof quote.subtotal === 'number' &&
    Number.isFinite(quote.subtotal) &&
    typeof quote.taxAmount === 'number' &&
    Number.isFinite(quote.taxAmount) &&
    typeof quote.taxCalculationMethod === 'string' &&
    typeof quote.taxName === 'string' &&
    typeof quote.taxCountry === 'string' &&
    typeof quote.storeCurrency === 'string' &&
    typeof quote.meta === 'object' &&
    quote.meta !== null
  );
}

export function verifyCheckoutQuoteToken(
  token: string,
  user: QuoteUser,
  items: CheckoutInventoryItem[],
): CheckoutShippingOption {
  const [encodedPayload, providedSignature, extra] = token.split('.');
  if (!encodedPayload || !providedSignature || extra !== undefined) {
    throw new Error('La cotización de envío no es válida. Volvé a cotizar el envío.');
  }
  const expectedSignature = Buffer.from(sign(encodedPayload));
  const actualSignature = Buffer.from(providedSignature);
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    throw new Error('La cotización de envío no es válida. Volvé a cotizar el envío.');
  }

  let payload: SignedQuote;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SignedQuote;
  } catch {
    throw new Error('La cotización de envío no se pudo leer. Volvé a cotizar el envío.');
  }

  if (
    payload.version !== 3 ||
    payload.userId !== user.id ||
    payload.expiresAt <= Date.now() ||
    payload.cartFingerprint !== checkoutCartFingerprint(items) ||
    payload.addressFingerprint !== checkoutAddressFingerprint(user) ||
    !isValidQuote(payload.quote)
  ) {
    throw new Error(
      'La cotización venció o cambió el carrito/la dirección. Volvé a cotizar el envío.',
    );
  }

  return { ...payload.quote, quoteToken: token };
}
