-- Tipster onboarding v2 (OB-020): richer personal details captured in the
-- guided wizard — public identity (name/country), a preferred direct-contact
-- channel, billing cadence, social "digital identity" handles, and an uploaded
-- official document backing the optional verification step.

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('weekly', 'monthly');

-- AlterTable
ALTER TABLE "Tipster"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "contactMethod" TEXT,
  ADD COLUMN "contactValue" TEXT,
  ADD COLUMN "billingInterval" "BillingInterval" NOT NULL DEFAULT 'monthly',
  ADD COLUMN "socialX" TEXT,
  ADD COLUMN "socialInstagram" TEXT,
  ADD COLUMN "socialTelegram" TEXT,
  ADD COLUMN "identityDocPath" TEXT,
  ADD COLUMN "identityDocName" TEXT,
  ADD COLUMN "identityDocSubmittedAt" TIMESTAMP(3);
