CREATE TABLE "PaymentCustomer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accountScope" TEXT NOT NULL,
    "externalCustomerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PaymentCustomer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SavedPaymentMethod" (
    "id" TEXT NOT NULL,
    "paymentCustomerId" TEXT NOT NULL,
    "externalCardId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "paymentType" TEXT,
    "paymentMethodName" TEXT,
    "lastFourDigits" TEXT,
    "expirationMonth" INTEGER,
    "expirationYear" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedPaymentMethod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentCustomer_userId_provider_accountScope_key"
    ON "PaymentCustomer"("userId", "provider", "accountScope");
CREATE UNIQUE INDEX "PaymentCustomer_provider_accountScope_externalCustomerId_key"
    ON "PaymentCustomer"("provider", "accountScope", "externalCustomerId");
CREATE INDEX "PaymentCustomer_userId_provider_idx"
    ON "PaymentCustomer"("userId", "provider");

CREATE UNIQUE INDEX "SavedPaymentMethod_paymentCustomerId_externalCardId_key"
    ON "SavedPaymentMethod"("paymentCustomerId", "externalCardId");
CREATE INDEX "SavedPaymentMethod_paymentCustomerId_createdAt_idx"
    ON "SavedPaymentMethod"("paymentCustomerId", "createdAt");

ALTER TABLE "PaymentCustomer"
    ADD CONSTRAINT "PaymentCustomer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedPaymentMethod"
    ADD CONSTRAINT "SavedPaymentMethod_paymentCustomerId_fkey"
    FOREIGN KEY ("paymentCustomerId") REFERENCES "PaymentCustomer"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
