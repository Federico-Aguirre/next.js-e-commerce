ALTER TABLE "User" ADD COLUMN "phone" VARCHAR(32);
ALTER TABLE "User" ADD COLUMN "discordUserId" VARCHAR(32);
ALTER TABLE "Order" ADD COLUMN "lastDeliveryAlertAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_discordUserId_key" ON "User"("discordUserId");
