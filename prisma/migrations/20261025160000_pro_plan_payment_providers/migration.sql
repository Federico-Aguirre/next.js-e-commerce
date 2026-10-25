ALTER TABLE "StoreSubscription"
ADD COLUMN "pendingProPaymentId" TEXT,
ADD COLUMN "pendingProPaymentProvider" TEXT,
ADD COLUMN "pendingProPaymentExpiresAt" TIMESTAMP(3);

ALTER TABLE "StoreSubscriptionPayment"
ALTER COLUMN "stripeCheckoutSessionId" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP NOT NULL,
ALTER COLUMN "paidAt" DROP DEFAULT,
ADD COLUMN "paymentProvider" TEXT NOT NULL DEFAULT 'STRIPE',
ADD COLUMN "externalPaymentId" TEXT,
ADD COLUMN "providerTransactionId" TEXT,
ADD COLUMN "paymentAttemptId" TEXT,
ADD COLUMN "paymentMethodRef" TEXT,
ADD COLUMN "paymentAmount" DOUBLE PRECISION NOT NULL DEFAULT 75000,
ADD COLUMN "paymentCurrency" TEXT NOT NULL DEFAULT 'ARS',
ADD COLUMN "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 1;

UPDATE "StoreSubscriptionPayment"
SET "externalPaymentId" = "stripePaymentIntentId"
WHERE "stripePaymentIntentId" IS NOT NULL;

CREATE UNIQUE INDEX "StoreSubscriptionPayment_paymentAttemptId_key"
ON "StoreSubscriptionPayment"("paymentAttemptId");

CREATE UNIQUE INDEX "StoreSubscriptionPayment_paymentProvider_externalPaymentId_key"
ON "StoreSubscriptionPayment"("paymentProvider", "externalPaymentId");

CREATE UNIQUE INDEX "StoreSubscriptionPayment_paymentProvider_providerTransactionId_key"
ON "StoreSubscriptionPayment"("paymentProvider", "providerTransactionId");

CREATE INDEX "StoreSubscriptionPayment_adminUserId_paymentProvider_createdAt_idx"
ON "StoreSubscriptionPayment"("adminUserId", "paymentProvider", "createdAt");
