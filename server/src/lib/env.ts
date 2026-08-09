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
