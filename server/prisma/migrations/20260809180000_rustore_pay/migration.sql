-- Drop YooKassa columns (no longer used — billing moved to RuStore Pay, which manages
-- its own recurring charges; we only mirror subscription status from its webhook).
ALTER TABLE "subscriptions" DROP COLUMN "yookassa_payment_id";
ALTER TABLE "subscriptions" DROP COLUMN "yookassa_payment_method_id";

-- Latest RuStore purchaseId, for support/debugging lookups only.
ALTER TABLE "subscriptions" ADD COLUMN "rustore_purchase_id" TEXT;
