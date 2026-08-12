-- RuStore Push SDK token, set by the client via PATCH /auth/push-token.
ALTER TABLE "users" ADD COLUMN "rustore_push_token" TEXT;
