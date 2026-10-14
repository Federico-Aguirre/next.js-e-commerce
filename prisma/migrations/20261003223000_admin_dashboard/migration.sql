-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "estimatedDeliveryAt" TIMESTAMP(3),
ADD COLUMN     "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "trackingCode" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AnalyticsVisit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSubscription" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "nextPaymentAt" TIMESTAMP(3),
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsVisit_sessionId_key" ON "AnalyticsVisit"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsVisit_createdAt_idx" ON "AnalyticsVisit"("createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsVisit_device_createdAt_idx" ON "AnalyticsVisit"("device", "createdAt");

