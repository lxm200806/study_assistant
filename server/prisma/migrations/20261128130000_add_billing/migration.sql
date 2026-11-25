CREATE TABLE "membership_plans" (
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "days" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "payment_orders" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "planCode" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "providerOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "payment_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_orders_userId_createdAt_idx" ON "payment_orders"("userId", "createdAt");
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "membership_plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;
