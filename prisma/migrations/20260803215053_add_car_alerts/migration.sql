-- AlterTable
ALTER TABLE "User" ADD COLUMN     "locale" TEXT;

-- CreateTable
CREATE TABLE "AlertCriteria" (
    "id" TEXT NOT NULL,
    "criteriaHash" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "lastPolledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertCriteria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribeTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertSeenListing" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertSeenListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertMatch" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "image" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "fuel" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "mileage" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertPollJob" (
    "id" TEXT NOT NULL,
    "criteriaId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertPollJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceHealth" (
    "source" TEXT NOT NULL,
    "lastOkAt" TIMESTAMP(3),
    "consecutiveEmptyRuns" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceHealth_pkey" PRIMARY KEY ("source")
);

-- CreateIndex
CREATE UNIQUE INDEX "AlertCriteria_criteriaHash_key" ON "AlertCriteria"("criteriaHash");

-- CreateIndex
CREATE INDEX "AlertCriteria_lastPolledAt_idx" ON "AlertCriteria"("lastPolledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_unsubscribeTokenHash_key" ON "Alert"("unsubscribeTokenHash");

-- CreateIndex
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");

-- CreateIndex
CREATE INDEX "Alert_criteriaId_idx" ON "Alert"("criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_userId_criteriaId_key" ON "Alert"("userId", "criteriaId");

-- CreateIndex
CREATE INDEX "AlertSeenListing_criteriaId_idx" ON "AlertSeenListing"("criteriaId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertSeenListing_criteriaId_listingId_key" ON "AlertSeenListing"("criteriaId", "listingId");

-- CreateIndex
CREATE INDEX "AlertMatch_alertId_notifiedAt_idx" ON "AlertMatch"("alertId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertMatch_alertId_listingId_key" ON "AlertMatch"("alertId", "listingId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertPollJob_criteriaId_key" ON "AlertPollJob"("criteriaId");

-- CreateIndex
CREATE INDEX "AlertPollJob_status_availableAt_enqueuedAt_idx" ON "AlertPollJob"("status", "availableAt", "enqueuedAt");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "AlertCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertSeenListing" ADD CONSTRAINT "AlertSeenListing_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "AlertCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertMatch" ADD CONSTRAINT "AlertMatch_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "Alert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPollJob" ADD CONSTRAINT "AlertPollJob_criteriaId_fkey" FOREIGN KEY ("criteriaId") REFERENCES "AlertCriteria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
