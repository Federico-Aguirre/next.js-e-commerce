CREATE TABLE IF NOT EXISTS "ConsumerRequest" (
  "id" TEXT NOT NULL,
  "requestCode" TEXT NOT NULL,
  "requestType" TEXT NOT NULL DEFAULT 'WITHDRAWAL',
  "orderNumber" INTEGER,
  "customerEmail" TEXT NOT NULL,
  "details" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsumerRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ConsumerRequest_requestCode_key"
  ON "ConsumerRequest"("requestCode");
CREATE INDEX IF NOT EXISTS "ConsumerRequest_status_createdAt_idx"
  ON "ConsumerRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "ConsumerRequest_customerEmail_createdAt_idx"
  ON "ConsumerRequest"("customerEmail", "createdAt");
