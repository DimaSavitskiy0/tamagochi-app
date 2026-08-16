import { env } from './env';
import { getRustorePublicToken, isRustoreApiAuthConfigured } from './rustoreApiAuth';

// RuStore's Public API for managing subscriptions server-side (as opposed to
// lib/rustorePay.ts, which only *receives* webhook notifications). Auth is a
// short-lived Public-Token — see lib/rustoreApiAuth.ts for how it's derived from the
// RSA key generated in RuStore Console → API RuStore → Создать ключ, scoped to just
// the two methods this file calls ("Получение данных подписки", "Отмена подписки").
// See server/README.md.
const BASE_URL = 'https://public-api.rustore.ru/public';

export function isRustoreApiConfigured(): boolean {
  return isRustoreApiAuthConfigured() && Boolean(env.rustoreAppId);
}

type RustoreApiResponse<T> = { code: 'OK' | 'ERROR'; message: string | null; body: T | null };

class RustoreApiError extends Error {
  constructor(message: string) {
    super(`RuStore API error: ${message}`);
  }
}

async function callRustoreApi<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  if (!isRustoreApiConfigured()) {
    throw new Error('RuStore Public API is not configured (RUSTORE_API_TOKEN/RUSTORE_API_KEY_ID/RUSTORE_APP_ID)');
  }
  const publicToken = await getRustorePublicToken();
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...init.headers, 'Public-Token': publicToken },
  });
  const data = (await response.json().catch(() => null)) as RustoreApiResponse<T> | null;
  if (!response.ok || !data || data.code !== 'OK') {
    throw new RustoreApiError(data?.message ?? `HTTP ${response.status}`);
  }
  return data.body;
}

// Cancels at the end of the current billing period — RuStore keeps access active until
// then and later sends the usual webhook (status_new: CLOSED) once it actually ends, so
// we don't flip our own subscriptions.status here; the webhook handler in
// routes/payments.ts is still the single source of truth for that.
export async function cancelSubscription(purchaseId: string): Promise<void> {
  await callRustoreApi(`/v1/applications/${env.rustoreAppId}/subscriptions/${purchaseId}:cancel`, {
    method: 'PATCH',
  });
}

export type RustoreSubscriptionData = {
  startTimeMillis: string;
  expiryTimeMillis: string;
  autoRenewing: boolean;
  paymentState?: number;
  cancelReason?: number;
};

// Not called anywhere yet — kept as a small building block for a future "next billing
// date" display, since RuStore's webhook payload doesn't carry expiryTimeMillis itself.
export async function getSubscriptionData(purchaseId: string): Promise<RustoreSubscriptionData | null> {
  return callRustoreApi<RustoreSubscriptionData>(
    `/v4/subscription/com.lapgoapp.app/${encodeURIComponent(env.rustoreSubscriptionProductCode)}/${purchaseId}`
  );
}
