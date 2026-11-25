CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "detail" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_audit_logs_actorId_createdAt_idx" ON "admin_audit_logs"("actorId", "createdAt");

ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
