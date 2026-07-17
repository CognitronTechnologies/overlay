-- User reports about tipsters (OB-161): raised by a subscriber, reviewed by admin.
-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "TipsterReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "tipsterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TipsterReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TipsterReport_status_idx" ON "TipsterReport"("status");

-- CreateIndex
CREATE INDEX "TipsterReport_tipsterId_idx" ON "TipsterReport"("tipsterId");

-- CreateIndex
CREATE INDEX "TipsterReport_reporterId_idx" ON "TipsterReport"("reporterId");

-- AddForeignKey
ALTER TABLE "TipsterReport" ADD CONSTRAINT "TipsterReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TipsterReport" ADD CONSTRAINT "TipsterReport_tipsterId_fkey" FOREIGN KEY ("tipsterId") REFERENCES "Tipster"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;
