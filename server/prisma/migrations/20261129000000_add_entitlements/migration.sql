-- AlterTable
ALTER TABLE "membership_plans" ADD COLUMN     "creditAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "groupKey" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'subscription',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subject" TEXT NOT NULL DEFAULT 'english';

-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN     "planSnapshot" JSONB;

-- CreateTable
CREATE TABLE "permissions" (
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "groupKey" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL DEFAULT 'access',
    "unit" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "plan_permissions" (
    "planCode" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "limitValue" INTEGER,
    "period" TEXT,

    CONSTRAINT "plan_permissions_pkey" PRIMARY KEY ("planCode","permissionKey")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "planCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'order',
    "orderId" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlement_grants" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3),
    "limitValue" INTEGER,
    "period" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlement_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_wallets" (
    "accountId" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_wallets_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "permissionKey" TEXT,
    "learnerId" TEXT,
    "refId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_counters" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL DEFAULT 'account',
    "permissionKey" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permissions_subject_active_idx" ON "permissions"("subject", "active");

-- CreateIndex
CREATE INDEX "subscriptions_accountId_status_endsAt_idx" ON "subscriptions"("accountId", "status", "endsAt");

-- CreateIndex
CREATE INDEX "subscriptions_planCode_idx" ON "subscriptions"("planCode");

-- CreateIndex
CREATE INDEX "entitlement_grants_accountId_permissionKey_endsAt_idx" ON "entitlement_grants"("accountId", "permissionKey", "endsAt");

-- CreateIndex
CREATE INDEX "entitlement_grants_sourceType_sourceId_idx" ON "entitlement_grants"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "credit_ledger_accountId_createdAt_idx" ON "credit_ledger"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "usage_counters_accountId_permissionKey_periodKey_idx" ON "usage_counters"("accountId", "permissionKey", "periodKey");

-- CreateIndex
CREATE UNIQUE INDEX "usage_counters_accountId_scopeId_permissionKey_periodKey_key" ON "usage_counters"("accountId", "scopeId", "permissionKey", "periodKey");

-- CreateIndex
CREATE INDEX "membership_plans_subject_kind_active_idx" ON "membership_plans"("subject", "kind", "active");

-- AddForeignKey
ALTER TABLE "plan_permissions" ADD CONSTRAINT "plan_permissions_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "membership_plans"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_permissions" ADD CONSTRAINT "plan_permissions_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planCode_fkey" FOREIGN KEY ("planCode") REFERENCES "membership_plans"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlement_grants" ADD CONSTRAINT "entitlement_grants_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_wallets" ADD CONSTRAINT "credit_wallets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_counters" ADD CONSTRAINT "usage_counters_permissionKey_fkey" FOREIGN KEY ("permissionKey") REFERENCES "permissions"("key") ON DELETE CASCADE ON UPDATE CASCADE;

