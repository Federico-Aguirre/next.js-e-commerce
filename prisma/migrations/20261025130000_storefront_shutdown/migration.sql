ALTER TABLE "StoreSubscription"
ADD COLUMN "storefrontStatus" TEXT NOT NULL DEFAULT 'OPEN',
ADD COLUMN "storefrontClosedAt" TIMESTAMP(3);
