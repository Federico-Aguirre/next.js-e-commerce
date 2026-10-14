ALTER TABLE "ProductSku"
  ADD COLUMN "lowStockAlertSent" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lowStockAlertedAt" TIMESTAMP(3);

CREATE TABLE "InventoryAlertSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "threshold" INTEGER NOT NULL DEFAULT 5,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAlertSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InventoryAlertSettings" ("id", "enabled", "threshold", "createdAt", "updatedAt")
VALUES ('default', false, 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
