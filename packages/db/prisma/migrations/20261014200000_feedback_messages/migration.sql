CREATE TABLE "FeedbackMessage" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topic" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',

    CONSTRAINT "FeedbackMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedbackMessage_status_createdAt_idx" ON "FeedbackMessage"("status", "createdAt");

ALTER TABLE "FeedbackMessage" ADD CONSTRAINT "FeedbackMessage_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
