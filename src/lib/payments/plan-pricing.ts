import { roundCurrencyAmount } from '@/lib/currency/currencies';
import { StoreConfig } from '@/utils/StoreConfig';

export const STANDARD_PLAN = 'STANDARD' as const;
export const CUSTOMIZATION_RECOVERY_PLAN = 'CUSTOMIZATION_RECOVERY' as const;
export const PRO_PLAN = 'PRO' as const;
export type PlatformPlanType =
  | typeof STANDARD_PLAN
  | typeof CUSTOMIZATION_RECOVERY_PLAN
  | typeof PRO_PLAN;
export type PlatformBasePlanType = typeof STANDARD_PLAN | typeof PRO_PLAN;

export const STANDARD_COMMISSION_PERCENT = 8;
export const RECOVERY_COMMISSION_PERCENT = 15;
export const CUSTOMIZATION_RECOVERY_SURCHARGE_PERCENT = 7;
export const PRO_COMMISSION_PERCENT = 2;
export const DEFAULT_RECOVERY_TARGET_ARS = 200_000;
export const DEFAULT_PRO_MONTHLY_PRICE_ARS = 75_000;

/** Older rows used CUSTOMIZATION_RECOVERY as the entire plan. Normalize them to the standard base plan. */
export function normalizePlanType(value: string): PlatformBasePlanType {
  return value === PRO_PLAN ? PRO_PLAN : STANDARD_PLAN;
}

export function commissionForPlan(planType: PlatformPlanType | PlatformBasePlanType) {
  return planType === PRO_PLAN ? PRO_COMMISSION_PERCENT : STANDARD_COMMISSION_PERCENT;
}

export type PlatformFeeBreakdown = {
  feeAmount: number;
  recoveryAmount: number;
  commissionPercent: number;
};

export function calculatePlatformFeeForPlan({
  subtotal,
  planType,
  customizationRecoveryActive = false,
  setupRecoveryTarget = DEFAULT_RECOVERY_TARGET_ARS,
  recoveredAmount = 0,
  reservedAmount = 0,
}: {
  subtotal: number;
  planType: PlatformPlanType | PlatformBasePlanType;
  /** Independent of the selected base plan so the surcharge survives Standard/Pro changes. */
  customizationRecoveryActive?: boolean;
  setupRecoveryTarget?: number;
  recoveredAmount?: number;
  reservedAmount?: number;
}): PlatformFeeBreakdown {
  const safeSubtotal = roundCurrencyAmount(Math.max(0, subtotal), StoreConfig.currency);
  const basePlanType = normalizePlanType(planType);
  const basePercent = commissionForPlan(basePlanType);
  // The legacy plan value also means recovery was explicitly enabled.
  const recoveryEnabled = customizationRecoveryActive || planType === CUSTOMIZATION_RECOVERY_PLAN;
  const baseFee = roundCurrencyAmount(safeSubtotal * (basePercent / 100), StoreConfig.currency);

  if (!recoveryEnabled) {
    return { feeAmount: baseFee, recoveryAmount: 0, commissionPercent: basePercent };
  }

  const availableRecovery = Math.max(0, setupRecoveryTarget - recoveredAmount - reservedAmount);
  const recoveryAmount = Math.min(
    roundCurrencyAmount(
      safeSubtotal * (CUSTOMIZATION_RECOVERY_SURCHARGE_PERCENT / 100),
      StoreConfig.currency,
    ),
    roundCurrencyAmount(availableRecovery, StoreConfig.currency),
  );
  const feeAmount = roundCurrencyAmount(baseFee + recoveryAmount, StoreConfig.currency);

  return {
    feeAmount,
    recoveryAmount,
    commissionPercent: safeSubtotal > 0 ? (feeAmount / safeSubtotal) * 100 : basePercent,
  };
}
