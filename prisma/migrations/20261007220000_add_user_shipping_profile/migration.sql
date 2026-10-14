ALTER TABLE "User"
ADD COLUMN "firstName" TEXT,
ADD COLUMN "lastName" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "dni" TEXT,
ADD COLUMN "shippingStreet" TEXT,
ADD COLUMN "shippingNumber" TEXT,
ADD COLUMN "shippingApartment" TEXT,
ADD COLUMN "shippingCity" TEXT,
ADD COLUMN "shippingProvince" TEXT,
ADD COLUMN "shippingPostalCode" TEXT,
ADD COLUMN "shippingCountry" TEXT DEFAULT 'Argentina';
