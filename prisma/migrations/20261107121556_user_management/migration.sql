-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'SUSPENDED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isProtectedAccount" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "phoneNumber" TEXT;

-- Enforce case-insensitive uniqueness in addition to normalized API input.
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (LOWER("username"));
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (LOWER("email")) WHERE "email" IS NOT NULL;
