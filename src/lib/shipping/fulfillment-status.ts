export type ProviderFulfillmentStatus = 'PREPARING' | 'SHIPPED' | 'DELIVERED';

/** Maps carrier tracking states to customer-facing fulfillment states. */
export function fulfillmentFromProviderStatus(status: string): ProviderFulfillmentStatus {
  const value = status
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  // A label/transaction can exist before the package has actually been handed to the carrier.
  // Check these before TRANSIT, because PRE_TRANSIT contains the word TRANSIT.
  if (
    value.includes('PRE_TRANSIT') ||
    value.includes('PRETRANSIT') ||
    value.includes('PRE_SHIPMENT') ||
    value.includes('LABEL_CREATED') ||
    value === 'NEW' ||
    value === 'SUCCESS' ||
    value === 'UNKNOWN'
  ) {
    return 'PREPARING';
  }

  // OUT_FOR_DELIVERY means the package is with the courier, not already delivered.
  if (value.includes('OUT_FOR_DELIVERY') || value.includes('OUT_FOR_DELIVER')) {
    return 'SHIPPED';
  }
  if (value.includes('DELIVERED') || value === 'DELIVERY_COMPLETE' || value === 'COMPLETED') {
    return 'DELIVERED';
  }
  if (value.includes('TRANSIT') || value.includes('SHIPPED') || value.includes('EN_ROUTE')) {
    return 'SHIPPED';
  }

  return 'PREPARING';
}
