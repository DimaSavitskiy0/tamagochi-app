import crypto from 'node:crypto';

import { env } from './env';

function basicAuthHeader(): string {
  return `Basic ${Buffer.from(`${env.yookassaShopId}:${env.yookassaSecretKey}`).toString('base64')}`;
}

export function isYookassaConfigured(): boolean {
  return Boolean(env.yookassaShopId && env.yookassaSecretKey);
}

type YookassaPayment = {
  id: string;
  status: string;
  confirmation?: { confirmation_url?: string };
  payment_method?: { id: string; saved?: boolean };
  metadata?: Record<string, string>;
};

async function postPayment(body: Record<string, unknown>): Promise<YookassaPayment> {
  const response = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      Authorization: basicAuthHeader(),
      'Idempotence-Key': crypto.randomUUID(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`YooKassa payment request failed: ${text}`);
  }

  return response.json() as Promise<YookassaPayment>;
}

// First payment for an owner — on-session, the owner is redirected to YooKassa's hosted
// page. save_payment_method asks YooKassa to keep the card on file so
// jobs/renewSubscriptions.ts can charge it automatically each following month without
// asking the owner to re-enter their card.
export function createYookassaPayment(ownerId: string): Promise<YookassaPayment> {
  return postPayment({
    amount: { value: env.yookassaProPriceRub, currency: 'RUB' },
    confirmation: { type: 'redirect', return_url: env.appReturnUrl },
    capture: true,
    save_payment_method: true,
    description: 'Тамагочи Pro — подписка на 1 месяц',
    metadata: { owner_id: ownerId },
  });
}

// Off-session recurring charge using a payment method saved from a previous payment —
// no confirmation/redirect, this runs unattended from jobs/renewSubscriptions.ts.
export function createRecurringPayment(ownerId: string, paymentMethodId: string): Promise<YookassaPayment> {
  return postPayment({
    amount: { value: env.yookassaProPriceRub, currency: 'RUB' },
    payment_method_id: paymentMethodId,
    capture: true,
    description: 'Тамагочи Pro — продление подписки',
    metadata: { owner_id: ownerId },
  });
}

// Never trust a webhook body's `status` field alone — YooKassa doesn't sign webhook
// payloads, so this re-fetches the payment by id straight from their API before acting
// on it (their own documented mitigation for the missing-signature gap).
export async function fetchYookassaPayment(paymentId: string): Promise<YookassaPayment> {
  const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    headers: { Authorization: basicAuthHeader() },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to verify payment with YooKassa: ${body}`);
  }

  return response.json() as Promise<YookassaPayment>;
}
