import { describe, expect, it } from 'vitest';
import {
  fromBuenosAiresDateTimeLocal,
  sameDeliveryMinute,
  toBuenosAiresDateTimeLocal,
} from './delivery-estimate';

describe('Buenos Aires delivery estimate time', () => {
  it('converts the dashboard local time to the correct instant', () => {
    const date = fromBuenosAiresDateTimeLocal('2026-10-18T14:30');
    expect(date?.toISOString()).toBe('2026-10-18T17:30:00.000Z');
  });

  it('formats saved instants back to the same Buenos Aires input value', () => {
    expect(toBuenosAiresDateTimeLocal('2026-10-18T17:30:00.000Z')).toBe('2026-10-18T14:30');
  });

  it('rejects malformed and impossible local date/time values', () => {
    expect(fromBuenosAiresDateTimeLocal('')).toBeNull();
    expect(fromBuenosAiresDateTimeLocal('2026-19-18T14:30')).toBeNull();
    expect(fromBuenosAiresDateTimeLocal('2026-10-18T25:30')).toBeNull();
  });

  it('compares delivery times to the minute because datetime-local has minute precision', () => {
    expect(
      sameDeliveryMinute(
        new Date('2026-10-18T17:30:00.000Z'),
        new Date('2026-10-18T17:30:59.000Z'),
      ),
    ).toBe(true);
    expect(
      sameDeliveryMinute(
        new Date('2026-10-18T17:30:00.000Z'),
        new Date('2026-10-18T17:31:00.000Z'),
      ),
    ).toBe(false);
  });
});
