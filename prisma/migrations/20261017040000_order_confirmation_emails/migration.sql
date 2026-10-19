CREATE TABLE IF NOT EXISTS "OrderEmailNotification" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PURCHASE_CONFIRMATION',
  "recipientEmail" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderEmailNotification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrderEmailNotification_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrderEmailNotification_orderId_type_key"
  ON "OrderEmailNotification"("orderId", "type");

CREATE INDEX IF NOT EXISTS "OrderEmailNotification_status_updatedAt_idx"
  ON "OrderEmailNotification"("status", "updatedAt");
