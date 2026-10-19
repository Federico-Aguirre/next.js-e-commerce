import { describe, expect, it } from 'vitest';
import { fulfillmentFromProviderStatus } from './fulfillment-status';

describe('fulfillmentFromProviderStatus', () => {
  it('keeps pre-transit labels in preparation', () => {
    expect(fulfillmentFromProviderStatus('PRE_TRANSIT')).toBe('PREPARING');
    expect(fulfillmentFromProviderStatus('label created')).toBe('PREPARING');
    expect(fulfillmentFromProviderStatus('SUCCESS')).toBe('PREPARING');
  });

  it('marks a package in transit as on the way', () => {
    expect(fulfillmentFromProviderStatus('TRANSIT')).toBe('SHIPPED');
    expect(fulfillmentFromProviderStatus('IN_TRANSIT')).toBe('SHIPPED');
    expect(fulfillmentFromProviderStatus('OUT_FOR_DELIVERY')).toBe('SHIPPED');
  });

  it('marks only completed deliveries as delivered', () => {
    expect(fulfillmentFromProviderStatus('DELIVERED')).toBe('DELIVERED');
    expect(fulfillmentFromProviderStatus('DELIVERY_COMPLETE')).toBe('DELIVERED');
  });
});
