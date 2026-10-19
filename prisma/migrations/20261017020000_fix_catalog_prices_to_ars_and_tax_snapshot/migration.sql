BEGIN;

-- Existing product and persistent-cart prices were stored in USD. Convert them exactly once
-- using the ExchangeRate-API USD/ARS reference rate captured on 2026-10-17 (00:02:32 UTC).
-- New catalog prices are fixed in ARS and represent the pre-tax price.
UPDATE "Product"
SET "price" = ROUND(("price"::numeric * 1514.5655), 2)::double precision;

UPDATE "CartItem"
SET "price" = ROUND(("price"::numeric * 1514.5655), 2)::double precision;

ALTER TABLE "Order"
  ADD COLUMN "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "taxRate" DOUBLE PRECISION,
  ADD COLUMN "taxCalculationMethod" TEXT,
  ADD COLUMN "taxCountry" TEXT,
  ADD COLUMN "taxName" TEXT;

-- Preserve every historical order total and currency. Existing orders predate tax snapshots;
-- they get an equal subtotal and zero recorded tax rather than being re-priced retroactively.
UPDATE "Order"
SET "subtotal" = "total",
    "taxAmount" = 0,
    "taxRate" = NULL;

ALTER TABLE "Order" ALTER COLUMN "currency" SET DEFAULT 'ARS';

COMMIT;
