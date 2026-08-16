import crypto from 'node:crypto';

import { env } from './env';

// RuStore's "API RuStore" auth is two-step, not a static bearer token:
//   1. Sign `keyId + timestamp` (no separator) with the RSA private key from the key
//      you created in Console → API RuStore, using SHA512withRSA.
//   2. POST { keyId, timestamp, signature } to /public/auth → get back a JWE token
//      valid for 900 seconds (15 min). *That* JWE is what goes in the Public-Token
//      header for every actual API call (subscription cancel/lookup, push send, etc.).
// See https://www.rustore.ru/help/en/work-with-rustore-api/api-authorization-token —
// the raw private key itself is never sent as a request header anywhere.
const AUTH_URL = 'https://public-api.rustore.ru/public/auth';

// Console shows the private key as a bare base64 blob (no PEM header/footer) — Node's
// crypto.sign needs proper PEM framing to parse it.
function toPem(rawKey: string): string {
  const trimmed = rawKey.trim();
  if (trimmed.includes('BEGIN')) return trimmed;
  const lines = trimmed.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
}

// ISO 8601 with milliseconds + numeric offset, e.g. 2023-08-11T13:31:17.580+03:00 —
// matches RuStore's documented example exactly (not the Z-suffixed form
// Date#toISOString gives by default).
function formatTimestamp(date: Date): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? '+' : '-';
  const offsetH = pad(Math.floor(Math.abs(offsetMin) / 60));
  const offsetM = pad(Math.abs(offsetMin) % 60);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}` +
    `${sign}${offsetH}:${offsetM}`
  );
}

let cachedToken: { jwe: string; expiresAt: number } | null = null;

export function isRustoreApiAuthConfigured(): boolean {
  return Boolean(env.rustoreApiToken && env.rustoreApiKeyId);
}

// Returns a live Public-Token, transparently re-authenticating when the cached one is
// within 60s of its 900s TTL — callers never see the sign/exchange step.
export async function getRustorePublicToken(): Promise<string> {
  if (!isRustoreApiAuthConfigured()) {
    throw new Error('RuStore API auth is not configured (RUSTORE_API_TOKEN/RUSTORE_API_KEY_ID)');
  }
  if (cachedToken && cachedToken.expiresAt - Date.now() > 60_000) {
    return cachedToken.jwe;
  }

  const timestamp = formatTimestamp(new Date());
  const signature = crypto
    .sign('RSA-SHA512', Buffer.from(`${env.rustoreApiKeyId}${timestamp}`), toPem(env.rustoreApiToken))
    .toString('base64');

  const response = await fetch(AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyId: env.rustoreApiKeyId, timestamp, signature }),
  });

  const data = (await response.json().catch(() => null)) as {
    code?: string;
    body?: { jwe?: string; ttl?: number };
    message?: string;
  } | null;

  if (!response.ok || !data || data.code !== 'OK' || !data.body?.jwe) {
    throw new Error(`RuStore auth exchange failed: ${data?.message ?? `HTTP ${response.status}`}`);
  }

  const ttlMs = (data.body.ttl ?? 900) * 1000;
  cachedToken = { jwe: data.body.jwe, expiresAt: Date.now() + ttlMs };
  return cachedToken.jwe;
}
