-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('UPLOADING', 'TRANSCRIBING', 'READY', 'RENDERING', 'FAILED');

-- CreateTable
CREATE TABLE "CaptionSession" (
    "id" TEXT NOT NULL,
    "accessTokenHash" TEXT NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'UPLOADING',
    "sourceFileName" TEXT NOT NULL,
    "sourcePath" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "frameRate" DOUBLE PRECISION,
    "videoCodec" TEXT,
    "captionData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptionSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CaptionSession_accessTokenHash_key" ON "CaptionSession"("accessTokenHash");

-- CreateIndex
CREATE INDEX "CaptionSession_lastActivityAt_idx" ON "CaptionSession"("lastActivityAt");
