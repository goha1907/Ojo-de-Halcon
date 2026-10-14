-- CreateTable
CREATE TABLE "TelegramOutbox" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "kind" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "TelegramOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TelegramOutbox_sentAt_createdAt_idx" ON "TelegramOutbox"("sentAt", "createdAt");

