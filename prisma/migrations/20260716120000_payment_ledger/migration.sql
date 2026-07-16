-- Funds ledger (OB-06x): one row per collected payment (or refund reversal).
-- Payouts are computed from summed collected revenue here — never from the raw
-- active-subscriber count — so the platform can only pay out money it received.
-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipsterId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "period" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_tipsterId_period_idx" ON "Payment"("tipsterId", "period");

-- CreateIndex
CREATE INDEX "Payment_userId_tipsterId_idx" ON "Payment"("userId", "tipsterId");
