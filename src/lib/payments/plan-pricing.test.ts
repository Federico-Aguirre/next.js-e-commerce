import { describe, expect, it } from 'vitest';
import {
  calculatePlatformFeeForPlan,
  CUSTOMIZATION_RECOVERY_PLAN,
  normalizePlanType,
  PRO_PLAN,
  STANDARD_PLAN,
} from './plan-pricing';

describe('platform plan commission calculation', () => {
  it('normalizes unknown plan types to the standard plan', () => {
    expect(normalizePlanType('legacy-plan')).toBe(STANDARD_PLAN);
  });

  it('charges 8% on the standard plan with no recovery surcharge', () => {
    expect(calculatePlatformFeeForPlan({ subtotal: 300_000, planType: STANDARD_PLAN })).toEqual({
      feeAmount: 24_000,
      recoveryAmount: 0,
      commissionPercent: 8,
    });
  });

  it('charges 2% on the Pro plan with no recovery surcharge', () => {
    expect(calculatePlatformFeeForPlan({ subtotal: 300_000, planType: PRO_PLAN })).toEqual({
      feeAmount: 6_000,
      recoveryAmount: 0,
      commissionPercent: 2,
    });
  });

  it('allocates only the additional 7% toward the customization target', () => {
    expect(
      calculatePlatformFeeForPlan({
        subtotal: 300_000,
        planType: CUSTOMIZATION_RECOVERY_PLAN,
        recoveredAmount: 10_000,
        reservedAmount: 2_000,
      }),
    ).toEqual({ feeAmount: 45_000, recoveryAmount: 21_000, commissionPercent: 15 });
  });

  it('keeps the customization surcharge when the administrator switches to Pro', () => {
    expect(
      calculatePlatformFeeForPlan({
        subtotal: 300_000,
        planType: PRO_PLAN,
        customizationRecoveryActive: true,
        recoveredAmount: 10_000,
        reservedAmount: 2_000,
      }),
    ).toEqual({ feeAmount: 27_000, recoveryAmount: 21_000, commissionPercent: 9 });
  });

  it('keeps already recovered amounts and caps the surcharge independently of the base plan', () => {
    expect(
      calculatePlatformFeeForPlan({
        subtotal: 300_000,
        planType: PRO_PLAN,
        customizationRecoveryActive: true,
        setupRecoveryTarget: 200_000,
        recoveredAmount: 199_000,
      }),
    ).toEqual({
      feeAmount: 7_000,
      recoveryAmount: 1_000,
      commissionPercent: (7_000 / 300_000) * 100,
    });
  });

  it('caps the last recovery surcharge at the remaining ARS amount', () => {
    expect(
      calculatePlatformFeeForPlan({
        subtotal: 300_000,
        planType: CUSTOMIZATION_RECOVERY_PLAN,
        recoveredAmount: 199_000,
      }),
    ).toEqual({
      feeAmount: 25_000,
      recoveryAmount: 1_000,
      commissionPercent: (25_000 / 300_000) * 100,
    });
  });

  it('reserves the recovery target for pending checkout sessions', () => {
    expect(
      calculatePlatformFeeForPlan({
        subtotal: 1_000_000,
        planType: CUSTOMIZATION_RECOVERY_PLAN,
        recoveredAmount: 150_000,
        reservedAmount: 30_000,
      }),
    ).toEqual({ feeAmount: 100_000, recoveryAmount: 20_000, commissionPercent: 10 });
  });

  it('does not calculate a negative fee for an invalid negative subtotal', () => {
    expect(calculatePlatformFeeForPlan({ subtotal: -500, planType: PRO_PLAN }).feeAmount).toBe(0);
  });
});
