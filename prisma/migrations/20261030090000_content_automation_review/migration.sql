ALTER TYPE "ArticleStatus" ADD VALUE IF NOT EXISTS 'rejected';
CREATE TYPE "FreeTipStatus" AS ENUM ('draft', 'pending', 'published', 'rejected', 'expired');
CREATE TYPE "ContentOrigin" AS ENUM ('manual', 'automation');
CREATE TYPE "AutomationRunStatus" AS ENUM ('running', 'succeeded', 'failed', 'partial');

ALTER TABLE "Article" ALTER COLUMN "authorId" DROP NOT NULL;
ALTER TABLE "Article"
  ADD COLUMN "origin" "ContentOrigin" NOT NULL DEFAULT 'manual',
  ADD COLUMN "sources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "reviewerWarnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "automationRunId" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT;

CREATE TABLE "AutomationRun" (
  "id" TEXT NOT NULL,
  "workflowName" TEXT NOT NULL,
  "externalRunId" TEXT,
  "externalRunUrl" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "status" "AutomationRunStatus" NOT NULL DEFAULT 'running',
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "rejectedCount" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FreeTip"
  ADD COLUMN "status" "FreeTipStatus" NOT NULL DEFAULT 'published',
  ADD COLUMN "origin" "ContentOrigin" NOT NULL DEFAULT 'manual',
  ADD COLUMN "sources" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "reviewerWarnings" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "automationRunId" TEXT,
  ADD COLUMN "dedupeKey" TEXT,
  ADD COLUMN "reviewedBy" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "kickoffAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "oddsProvider" TEXT,
  ADD COLUMN "oddsRetrievedAt" TIMESTAMP(3),
  ADD COLUMN "rationale" JSONB;

-- Explicitly preserve visibility of every legacy manually curated tip.
UPDATE "FreeTip" SET "status" = 'published';

CREATE UNIQUE INDEX "Article_dedupeKey_key" ON "Article"("dedupeKey");
CREATE UNIQUE INDEX "FreeTip_dedupeKey_key" ON "FreeTip"("dedupeKey");
CREATE UNIQUE INDEX "AutomationRun_workflowName_externalRunId_key" ON "AutomationRun"("workflowName", "externalRunId");
CREATE INDEX "Article_automationRunId_idx" ON "Article"("automationRunId");
CREATE INDEX "FreeTip_status_tipDate_idx" ON "FreeTip"("status", "tipDate");
CREATE INDEX "FreeTip_status_kickoffAt_expiresAt_idx" ON "FreeTip"("status", "kickoffAt", "expiresAt");
CREATE INDEX "FreeTip_automationRunId_idx" ON "FreeTip"("automationRunId");
CREATE INDEX "AutomationRun_startedAt_idx" ON "AutomationRun"("startedAt");
CREATE INDEX "AutomationRun_status_startedAt_idx" ON "AutomationRun"("status", "startedAt");

ALTER TABLE "Article" ADD CONSTRAINT "Article_automationRunId_fkey"
  FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FreeTip" ADD CONSTRAINT "FreeTip_automationRunId_fkey"
  FOREIGN KEY ("automationRunId") REFERENCES "AutomationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FreeTip" ADD CONSTRAINT "FreeTip_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
