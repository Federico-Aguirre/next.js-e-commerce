CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProductReview_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX "ProductReview_productId_userId_key" ON "ProductReview"("productId", "userId");
CREATE INDEX "ProductReview_productId_createdAt_idx" ON "ProductReview"("productId", "createdAt");
CREATE INDEX "ProductReview_orderId_idx" ON "ProductReview"("orderId");

ALTER TABLE "ProductReview"
ADD CONSTRAINT "ProductReview_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReview"
ADD CONSTRAINT "ProductReview_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReview"
ADD CONSTRAINT "ProductReview_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
