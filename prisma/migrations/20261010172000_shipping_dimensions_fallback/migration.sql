-- Let the application-level DEFAULT_PACKAGE_* values act as true fallbacks.
ALTER TABLE "ProductSku"
  ALTER COLUMN "shippingWeightGrams" DROP DEFAULT,
  ALTER COLUMN "shippingWeightGrams" DROP NOT NULL,
  ALTER COLUMN "shippingLengthCm" DROP DEFAULT,
  ALTER COLUMN "shippingLengthCm" DROP NOT NULL,
  ALTER COLUMN "shippingWidthCm" DROP DEFAULT,
  ALTER COLUMN "shippingWidthCm" DROP NOT NULL,
  ALTER COLUMN "shippingHeightCm" DROP DEFAULT,
  ALTER COLUMN "shippingHeightCm" DROP NOT NULL;

UPDATE "ProductSku"
SET
  "shippingWeightGrams" = NULL,
  "shippingLengthCm" = NULL,
  "shippingWidthCm" = NULL,
  "shippingHeightCm" = NULL
WHERE
  "shippingWeightGrams" = 500
  AND "shippingLengthCm" = 30
  AND "shippingWidthCm" = 25
  AND "shippingHeightCm" = 5;
