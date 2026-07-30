-- AlterTable
ALTER TABLE "users" ADD COLUMN "consent_given_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN "yookassa_payment_method_id" TEXT;
