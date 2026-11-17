-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('BERJALAN', 'SELESAI');

-- CreateEnum
CREATE TYPE "public"."TransportStatus" AS ENUM ('DIAJUKAN', 'DISETUJUI', 'DIBAYAR');

-- CreateTable
CREATE TABLE "public"."Interviewer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 0,
    "startDate" DATE NOT NULL,
    "isPC" BOOLEAN NOT NULL DEFAULT false,
    "status" "public"."ProjectStatus" NOT NULL DEFAULT 'BERJALAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" SERIAL NOT NULL,
    "interviewerId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "otherAreas" TEXT,
    "notes" TEXT,
    "transportAmount" INTEGER,
    "transportNote" TEXT,
    "transportStatus" "public"."TransportStatus",
    "transportStatusUpdatedAt" TIMESTAMP(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportItem" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "area" TEXT NOT NULL,

    CONSTRAINT "ReportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportHistory" (
    "id" SERIAL NOT NULL,
    "reportId" INTEGER NOT NULL,
    "revision" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Matching" (
    "id" SERIAL NOT NULL,
    "interviewerId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "actualCount" INTEGER NOT NULL,
    "note" TEXT,
    "followedUp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matching_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Interviewer_name_key" ON "public"."Interviewer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_code_key" ON "public"."Project"("code");

-- CreateIndex
CREATE INDEX "Report_date_idx" ON "public"."Report"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Report_interviewerId_date_key" ON "public"."Report"("interviewerId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ReportItem_reportId_projectId_key" ON "public"."ReportItem"("reportId", "projectId");

-- CreateIndex
CREATE INDEX "ReportHistory_reportId_idx" ON "public"."ReportHistory"("reportId");

-- CreateIndex
CREATE INDEX "Matching_date_idx" ON "public"."Matching"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Matching_interviewerId_projectId_date_key" ON "public"."Matching"("interviewerId", "projectId", "date");

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "public"."Interviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportItem" ADD CONSTRAINT "ReportItem_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportItem" ADD CONSTRAINT "ReportItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportHistory" ADD CONSTRAINT "ReportHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Matching" ADD CONSTRAINT "Matching_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "public"."Interviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Matching" ADD CONSTRAINT "Matching_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
