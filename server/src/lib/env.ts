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
  // YooKassa + Anthropic are only needed for the payments/ai-tip routes — validated
  // lazily there instead of here, so the rest of the API still runs without them
  // configured (useful for local dev before those accounts/keys exist).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  yookassaShopId: process.env.YOOKASSA_SHOP_ID ?? '',
  yookassaSecretKey: process.env.YOOKASSA_SECRET_KEY ?? '',
  yookassaProPriceRub: process.env.PRO_PLAN_PRICE_RUB ?? '199.00',
  appReturnUrl: process.env.APP_RETURN_URL ?? 'https://example.com/payment-complete',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  // SMTP is only needed for POST /auth/forgot-password — without it, the endpoint still
  // works (code is generated and stored) but no email actually goes out, same "optional,
  // degrades gracefully" pattern as the integrations above.
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  smtpFrom: process.env.SMTP_FROM ?? 'Тамагочи <no-reply@tamagochi.app>',
};
