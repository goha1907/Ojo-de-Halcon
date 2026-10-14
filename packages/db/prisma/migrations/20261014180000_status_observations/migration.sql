CREATE TABLE "StatusObservation" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatusObservation_kind_field_value_key" ON "StatusObservation"("kind", "field", "value");
CREATE INDEX "StatusObservation_kind_field_idx" ON "StatusObservation"("kind", "field");
