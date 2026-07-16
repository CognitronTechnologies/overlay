-- Payout approvals + balance accounting (weekly schedule + on-demand).
-- AlterEnum
ALTER TYPE "PayoutStatus" ADD VALUE 'awaiting_approval';
ALTER TYPE "PayoutStatus" ADD VALUE 'rejected';

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN "grossCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payout" ADD COLUMN "feeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Payout" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'scheduled';

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_tipsterId_idx" ON "Payout"("tipsterId");
