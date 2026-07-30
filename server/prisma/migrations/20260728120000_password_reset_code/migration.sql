-- AlterTable
ALTER TABLE "users" ADD COLUMN "reset_code_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_code_expires_at" TIMESTAMP(3);
