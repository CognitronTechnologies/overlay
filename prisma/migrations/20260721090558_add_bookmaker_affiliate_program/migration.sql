-- CreateTable
CREATE TABLE "Bookmaker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "website" TEXT NOT NULL,
    "destinationUrl" TEXT,
    "trackingParams" TEXT,
    "promoCode" TEXT,
    "promoCodeDescription" TEXT,
    "description" TEXT,
    "welcomeOffer" TEXT,
    "termsSummary" TEXT,
    "rating" DOUBLE PRECISION,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "supportedCountries" TEXT[],
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bookmaker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateOffer" (
    "id" TEXT NOT NULL,
    "bookmakerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cta" TEXT,
    "destinationUrl" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffiliateOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AffiliateClick" (
    "id" TEXT NOT NULL,
    "bookmakerId" TEXT NOT NULL,
    "offerId" TEXT,
    "userId" TEXT,
    "source" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "country" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliateClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bookmaker_slug_key" ON "Bookmaker"("slug");

-- CreateIndex
CREATE INDEX "Bookmaker_isActive_displayOrder_idx" ON "Bookmaker"("isActive", "displayOrder");

-- CreateIndex
CREATE INDEX "AffiliateOffer_bookmakerId_idx" ON "AffiliateOffer"("bookmakerId");

-- CreateIndex
CREATE INDEX "AffiliateOffer_isActive_idx" ON "AffiliateOffer"("isActive");

-- CreateIndex
CREATE INDEX "AffiliateClick_bookmakerId_idx" ON "AffiliateClick"("bookmakerId");

-- CreateIndex
CREATE INDEX "AffiliateClick_offerId_idx" ON "AffiliateClick"("offerId");

-- CreateIndex
CREATE INDEX "AffiliateClick_source_idx" ON "AffiliateClick"("source");

-- CreateIndex
CREATE INDEX "AffiliateClick_clickedAt_idx" ON "AffiliateClick"("clickedAt");

-- AddForeignKey
ALTER TABLE "AffiliateOffer" ADD CONSTRAINT "AffiliateOffer_bookmakerId_fkey" FOREIGN KEY ("bookmakerId") REFERENCES "Bookmaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_bookmakerId_fkey" FOREIGN KEY ("bookmakerId") REFERENCES "Bookmaker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AffiliateClick" ADD CONSTRAINT "AffiliateClick_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "AffiliateOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
