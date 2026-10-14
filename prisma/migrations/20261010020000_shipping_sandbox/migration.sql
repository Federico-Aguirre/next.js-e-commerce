ALTER TABLE "ProductSku"
ADD COLUMN "shippingWeightGrams" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN "shippingLengthCm" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "shippingWidthCm" INTEGER NOT NULL DEFAULT 25,
ADD COLUMN "shippingHeightCm" INTEGER NOT NULL DEFAULT 5;

ALTER TABLE "Order"
ADD COLUMN "shippingProvider" TEXT,
ADD COLUMN "shippingMode" TEXT,
ADD COLUMN "shippingExternalId" TEXT,
ADD COLUMN "shippingCarrier" TEXT,
ADD COLUMN "shippingService" TEXT,
ADD COLUMN "shippingRate" DOUBLE PRECISION,
ADD COLUMN "shippingCurrency" TEXT,
ADD COLUMN "shippingLabelUrl" TEXT,
ADD COLUMN "shippingTrackingUrl" TEXT,
ADD COLUMN "shippingStatus" TEXT,
ADD COLUMN "shippingError" TEXT;
