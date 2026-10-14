ALTER TABLE "Order"
  ADD COLUMN "paymentProvider" TEXT,
  ADD COLUMN "paymentExternalId" TEXT,
  ADD COLUMN "refundExternalId" TEXT,
  ADD COLUMN "refundStatus" TEXT,
  ADD COLUMN "refundedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3);
