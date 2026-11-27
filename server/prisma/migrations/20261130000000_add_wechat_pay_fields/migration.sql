-- AlterTable
ALTER TABLE "payment_orders" ADD COLUMN "outTradeNo" TEXT,
ADD COLUMN "channel" TEXT,
ADD COLUMN "payAppId" TEXT,
ADD COLUMN "prepayId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_outTradeNo_key" ON "payment_orders"("outTradeNo");
