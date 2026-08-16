import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwtAccessSecret: required('JWT_ACCESS_SECRET'),
  jwtRefreshSecret: required('JWT_REFRESH_SECRET'),
  // Anthropic + RuStore Pay are only needed for the ai-tip/payments routes — validated
  // lazily there instead of here, so the rest of the API still runs without them
  // configured (useful for local dev before those accounts/keys exist).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  // AES-256 key (base64) RuStore Console hands you once when you connect the server
  // notifications URL under Monetization → Server notifications. See lib/rustorePay.ts.
  rustoreWebhookSecret: process.env.RUSTORE_WEBHOOK_SECRET ?? '',
  // From RuStore Console → app → Push-уведомления → Проекты: project_id, and the
  // service token (ss_token) shown there — used as providers.rustore.auth_token when
  // calling RuStore's push Send API. See lib/rustorePushSend.ts.
  rustorePushProjectId: process.env.RUSTORE_PUSH_PROJECT_ID ?? '',
  rustorePushAuthToken: process.env.RUSTORE_PUSH_AUTH_TOKEN ?? '',
  // RuStore Console → API RuStore → Создать ключ, scoped to "Получение данных подписки" +
  // "Отмена подписки" only. Used by lib/rustoreApi.ts for the in-app "Отменить подписку"
  // button — not the same key/secret as rustorePushAuthToken above (different scope).
  // The RSA private key itself (PEM or bare base64 body) — not sent directly to RuStore
  // as a bearer token. See lib/rustoreApiAuth.ts: it's used to sign a short-lived
  // (900s) JWE exchange, which is the actual value sent as Public-Token.
  rustoreApiToken: process.env.RUSTORE_API_TOKEN ?? '',
  // "ID ключа" shown next to the key in RuStore Console → API RuStore — not secret,
  // identifies which key signed the auth request.
  rustoreApiKeyId: process.env.RUSTORE_API_KEY_ID ?? '',
  // Numeric app id from RuStore Console (not secret — same value as consoleAppId in
  // app.json's withRuStorePay plugin config).
  rustoreAppId: process.env.RUSTORE_APP_ID ?? '',
  // Must match the product code created in RuStore Console → Монетизация → Подписки
  // (see constants/rustore.ts on the client — RUSTORE_PRO_PRODUCT_CODE).
  rustoreSubscriptionProductCode: process.env.RUSTORE_SUBSCRIPTION_PRODUCT_CODE ?? 'lapgo_pro_monthly',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  // SMTP is only needed for POST /auth/forgot-password — without it, the endpoint still
  // works (code is generated and stored) but no email actually goes out, same "optional,
  // degrades gracefully" pattern as the integrations above.
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'ЛапGo <no-reply@lapgo.app>',
};
