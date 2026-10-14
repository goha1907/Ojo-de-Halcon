-- CreateEnum
CREATE TYPE "TrackerKind" AS ENUM ('RENAPER', 'CORREO', 'PJN');
-- CreateEnum
CREATE TYPE "TrackerStatus" AS ENUM ('PENDING_CONFIRMATION', 'ACTIVE', 'FINISHED');
-- CreateTable
CREATE TABLE "Tracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "TrackerKind" NOT NULL,
    "reference" TEXT NOT NULL,
    "label" TEXT,
    "linkGroupId" TEXT,
    "status" "TrackerStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Tracker_pkey" PRIMARY KEY ("id")
);
-- CreateTable
CREATE TABLE "TrackerSnapshot" (
    "trackerId" TEXT NOT NULL,
    "header" JSONB NOT NULL,
    "steps" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackerSnapshot_pkey" PRIMARY KEY ("trackerId")
);
-- CreateTable
CREATE TABLE "TrackerEvent" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notifiedAt" TIMESTAMP(3),
    CONSTRAINT "TrackerEvent_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "Tracker_status_nextCheckAt_idx" ON "Tracker"("status", "nextCheckAt");
-- CreateIndex
CREATE INDEX "Tracker_linkGroupId_idx" ON "Tracker"("linkGroupId");
-- CreateIndex
CREATE UNIQUE INDEX "Tracker_userId_kind_reference_key" ON "Tracker"("userId", "kind", "reference");
-- CreateIndex
CREATE INDEX "TrackerEvent_trackerId_idx" ON "TrackerEvent"("trackerId");
-- CreateIndex
CREATE INDEX "TrackerEvent_notifiedAt_idx" ON "TrackerEvent"("notifiedAt");
-- AddForeignKey
ALTER TABLE "Tracker" ADD CONSTRAINT "Tracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TrackerSnapshot" ADD CONSTRAINT "TrackerSnapshot_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "TrackerEvent" ADD CONSTRAINT "TrackerEvent_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
