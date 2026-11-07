-- CreateEnum
CREATE TYPE "AccountRequestStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RETURNED_FOR_CORRECTION');

-- CreateTable
CREATE TABLE "UserAccountRequest" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "passwordHash" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "campusId" TEXT,
    "organizationalUnitId" TEXT,
    "status" "AccountRequestStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "decisionReason" TEXT,
    "approvedUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "UserAccountRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountRequestDecision" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountRequestDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserAccountRequest_approvedUserId_key" ON "UserAccountRequest"("approvedUserId");

-- CreateIndex
CREATE INDEX "UserAccountRequest_requesterId_createdAt_idx" ON "UserAccountRequest"("requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "UserAccountRequest_status_createdAt_idx" ON "UserAccountRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserAccountRequest_roleId_idx" ON "UserAccountRequest"("roleId");

-- CreateIndex
CREATE INDEX "UserAccountRequest_campusId_idx" ON "UserAccountRequest"("campusId");

-- CreateIndex
CREATE INDEX "UserAccountRequest_organizationalUnitId_idx" ON "UserAccountRequest"("organizationalUnitId");

-- CreateIndex
CREATE INDEX "AccountRequestDecision_requestId_createdAt_idx" ON "AccountRequestDecision"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountRequestDecision_actorId_createdAt_idx" ON "AccountRequestDecision"("actorId", "createdAt");

-- A rejected or approved request releases its username and email reservation.
CREATE UNIQUE INDEX "UserAccountRequest_pending_username_key"
ON "UserAccountRequest"(LOWER("username"))
WHERE "status" = 'PENDING_APPROVAL';

CREATE UNIQUE INDEX "UserAccountRequest_pending_email_key"
ON "UserAccountRequest"(LOWER("email"))
WHERE "status" = 'PENDING_APPROVAL';

-- AddForeignKey
ALTER TABLE "UserAccountRequest" ADD CONSTRAINT "UserAccountRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountRequest" ADD CONSTRAINT "UserAccountRequest_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountRequest" ADD CONSTRAINT "UserAccountRequest_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountRequest" ADD CONSTRAINT "UserAccountRequest_organizationalUnitId_fkey" FOREIGN KEY ("organizationalUnitId") REFERENCES "OrganizationalUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAccountRequest" ADD CONSTRAINT "UserAccountRequest_approvedUserId_fkey" FOREIGN KEY ("approvedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRequestDecision" ADD CONSTRAINT "AccountRequestDecision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "UserAccountRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRequestDecision" ADD CONSTRAINT "AccountRequestDecision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
