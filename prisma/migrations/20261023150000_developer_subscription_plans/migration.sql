ALTER TABLE "StoreSubscription"
  ADD COLUMN "planType" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "setupRecoveryTarget" DOUBLE PRECISION NOT NULL DEFAULT 200000,
  ADD COLUMN "setupRecoveryStartedAt" TIMESTAMP(3),
  ADD COLUMN "monthlyPriceARS" DOUBLE PRECISION NOT NULL DEFAULT 75000;

ALTER TABLE "StoreSubscription"
  ALTER COLUMN "commissionPercent" SET DEFAULT 8;

-- The previous default was 10%; existing default-rate subscriptions now use the new 8% standard plan.
UPDATE "StoreSubscription"
SET "commissionPercent" = 8
WHERE "commissionPercent" = 10 AND "planType" = 'STANDARD';

ALTER TABLE "Order"
  ADD COLUMN "platformCommissionPercent" DOUBLE PRECISION,
  ADD COLUMN "platformFeeAmount" DOUBLE PRECISION,
  ADD COLUMN "platformRecoveryAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "platformRecoveryCycleStartedAt" TIMESTAMP(3);
