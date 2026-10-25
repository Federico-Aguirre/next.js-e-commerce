ALTER TABLE "StoreSubscription"
  ADD COLUMN "customizationRecoveryActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pendingProCheckoutSessionId" TEXT,
  ADD COLUMN "pendingProCheckoutExpiresAt" TIMESTAMP(3);

-- Legacy CUSTOMIZATION_RECOVERY rows mean the developer explicitly enabled the
-- 7-point recovery surcharge. Preserve their cycle timestamp and all paid order
-- snapshots while storing Standard/Pro as the independent base plan.
UPDATE "StoreSubscription"
SET
  "customizationRecoveryActive" = true,
  "planType" = 'STANDARD',
  "commissionPercent" = 8
WHERE "planType" = 'CUSTOMIZATION_RECOVERY';

-- A recovery start timestamp was only created when the developer enabled the
-- customization surcharge. If an older version let the admin switch plans, keep
-- recovering any unfinished balance instead of silently forgiving it. If the
-- target was already fully collected, do not reactivate the surcharge.
UPDATE "StoreSubscription" AS subscription
SET "customizationRecoveryActive" = (
  COALESCE((
    SELECT SUM("platformRecoveryAmount")
    FROM "Order"
    WHERE "status" = 'PAID'
      AND "platformRecoveryCycleStartedAt" = subscription."setupRecoveryStartedAt"
  ), 0) < subscription."setupRecoveryTarget" - 0.01
)
WHERE subscription."setupRecoveryStartedAt" IS NOT NULL;

CREATE TABLE "StoreSubscriptionPayment" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL DEFAULT 'default',
  "adminUserId" TEXT NOT NULL,
  "stripeCheckoutSessionId" TEXT NOT NULL,
  "stripePaymentIntentId" TEXT,
  "amountARS" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'ARS',
  "status" TEXT NOT NULL DEFAULT 'PAID',
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidThrough" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StoreSubscriptionPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StoreSubscriptionPayment_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "StoreSubscription"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "StoreSubscriptionPayment_stripeCheckoutSessionId_key"
  ON "StoreSubscriptionPayment"("stripeCheckoutSessionId");
CREATE UNIQUE INDEX "StoreSubscriptionPayment_stripePaymentIntentId_key"
  ON "StoreSubscriptionPayment"("stripePaymentIntentId");
CREATE INDEX "StoreSubscriptionPayment_adminUserId_createdAt_idx"
  ON "StoreSubscriptionPayment"("adminUserId", "createdAt");
CREATE INDEX "StoreSubscriptionPayment_paidThrough_idx"
  ON "StoreSubscriptionPayment"("paidThrough");
