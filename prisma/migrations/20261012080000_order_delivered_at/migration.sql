ALTER TABLE "Order" ADD COLUMN "deliveredAt" TIMESTAMP(3);

UPDATE "Order"
SET "deliveredAt" = "updatedAt"
WHERE "fulfillmentStatus" = 'DELIVERED'
  AND "deliveredAt" IS NULL;

CREATE INDEX "Order_deliveredAt_idx" ON "Order"("deliveredAt");
