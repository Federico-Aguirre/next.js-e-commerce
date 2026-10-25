CREATE TABLE "DeliveryAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Casa',
    "shippingStreet" TEXT NOT NULL,
    "shippingNumber" TEXT NOT NULL,
    "shippingApartment" TEXT,
    "shippingCity" TEXT NOT NULL,
    "shippingProvince" TEXT NOT NULL,
    "shippingPostalCode" TEXT NOT NULL,
    "shippingCountry" TEXT NOT NULL DEFAULT 'Argentina',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeliveryAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeliveryAddress_userId_isDefault_createdAt_idx"
    ON "DeliveryAddress"("userId", "isDefault", "createdAt");

CREATE UNIQUE INDEX "DeliveryAddress_one_default_per_user_key"
    ON "DeliveryAddress"("userId")
    WHERE "isDefault" = true;

ALTER TABLE "DeliveryAddress"
    ADD CONSTRAINT "DeliveryAddress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve the existing address in each profile as its first saved/default address.
INSERT INTO "DeliveryAddress" (
    "id", "userId", "label", "shippingStreet", "shippingNumber",
    "shippingApartment", "shippingCity", "shippingProvince",
    "shippingPostalCode", "shippingCountry", "isDefault", "createdAt", "updatedAt"
)
SELECT
    'legacy_' || md5(u."id" || ':default-delivery-address'),
    u."id",
    'Casa',
    trim(u."shippingStreet"),
    trim(u."shippingNumber"),
    NULLIF(trim(COALESCE(u."shippingApartment", '')), ''),
    trim(u."shippingCity"),
    trim(u."shippingProvince"),
    trim(u."shippingPostalCode"),
    COALESCE(NULLIF(trim(u."shippingCountry"), ''), 'Argentina'),
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User" u
WHERE trim(COALESCE(u."shippingStreet", '')) <> ''
  AND trim(COALESCE(u."shippingNumber", '')) <> ''
  AND trim(COALESCE(u."shippingCity", '')) <> ''
  AND trim(COALESCE(u."shippingProvince", '')) <> ''
  AND trim(COALESCE(u."shippingPostalCode", '')) <> ''
  AND trim(COALESCE(u."shippingCountry", '')) <> '';
