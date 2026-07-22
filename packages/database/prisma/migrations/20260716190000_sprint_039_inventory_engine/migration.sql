CREATE TYPE "InventoryEventType" AS ENUM ('CONTRIBUTION_RECORDED', 'CONTRIBUTION_VERIFIED', 'CONTRIBUTION_REJECTED', 'REVERSAL_RECORDED');
CREATE TYPE "InventoryEventStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REVERSED');

CREATE TABLE "InventoryEvent" (
  "id" TEXT NOT NULL,
  "eventType" "InventoryEventType" NOT NULL,
  "status" "InventoryEventStatus" NOT NULL,
  "tokenAmount" INTEGER NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "subjectUserId" TEXT,
  "cityId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "correlationId" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryEvent_idempotencyKey_key" ON "InventoryEvent"("idempotencyKey");
CREATE INDEX "InventoryEvent_actorUserId_occurredAt_idx" ON "InventoryEvent"("actorUserId", "occurredAt");
CREATE INDEX "InventoryEvent_subjectUserId_occurredAt_idx" ON "InventoryEvent"("subjectUserId", "occurredAt");
CREATE INDEX "InventoryEvent_cityId_occurredAt_idx" ON "InventoryEvent"("cityId", "occurredAt");
CREATE INDEX "InventoryEvent_correlationId_idx" ON "InventoryEvent"("correlationId");

ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
