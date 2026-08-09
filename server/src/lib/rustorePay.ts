import crypto from 'node:crypto';

import { env } from './env';

// Server Notifications from RuStore Pay: RuStore Console encrypts the `payload` field of
// every webhook with AES-256-GCM using a key it hands you once when you connect the
// notification URL. Parameters per RuStore's docs (server-set-up page):
//   - cipher: AES/GCM/NoPadding
//   - IV length: 12 bytes, prepended to the ciphertext
//   - tag length: 16 bytes, appended to the ciphertext (Java's Cipher.doFinal convention)
// The whole thing (iv + ciphertext + tag) arrives base64-encoded as one string.
const GCM_IV_LENGTH = 12;
const GCM_TAG_LENGTH = 16;

export function isRustorePayConfigured(): boolean {
  return Boolean(env.rustoreWebhookSecret);
}

export function decryptRustoreNotification(encryptedPayload: string): string {
  if (!env.rustoreWebhookSecret) {
    throw new Error('RUSTORE_WEBHOOK_SECRET is not configured');
  }

  const key = Buffer.from(env.rustoreWebhookSecret, 'base64');
  const decoded = Buffer.from(encryptedPayload, 'base64');

  const iv = decoded.subarray(0, GCM_IV_LENGTH);
  const rest = decoded.subarray(GCM_IV_LENGTH);
  const tag = rest.subarray(rest.length - GCM_TAG_LENGTH);
  const ciphertext = rest.subarray(0, rest.length - GCM_TAG_LENGTH);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

// Top-level POST body RuStore sends for every notification (real or test).
export type RustoreNotificationBody = {
  id: string;
  timestamp: string;
  payload: string; // base64, AES-256-GCM encrypted — decrypt with decryptRustoreNotification
};

// Shape of JSON.parse(decryptRustoreNotification(body.payload)).
export type RustoreDecryptedPayload = {
  app_id: number;
  notification_type:
    | 'INVOICE_STATUS'
    | 'INVOICE_STATUS_SANDBOX'
    | 'TEST_EVENT'
    | 'TEST_EVENT_SANDBOX'
    | 'SUBSCRIPTION_EVENT'
    | 'SUBSCRIPTION_EVENT_SANDBOX';
  // Also JSON-encoded as a string (not a nested object) — needs its own JSON.parse.
  data: string;
};

export type RustoreSubscriptionEventData = {
  product_code: string;
  event_time: string;
  subscription_event_type: 'ACTIVATED' | 'RENEWED' | 'CANCELLED' | 'RESUMED' | 'PAYMENT_FAILED' | 'CLOSED';
  status_new: 'ACTIVE' | 'PAUSED' | 'CLOSED' | 'TERMINATED';
  status_old?: string;
  period_old?: string;
  period_new?: string;
  autorenewing: boolean;
  invoice_id?: string;
  // Set to our own owner (user) id when the client starts the purchase (see
  // lib/rustorePay.ts on the client, `purchase({ orderId: ownerId })`) — this is how we
  // map a RuStore event back to a row in our own subscriptions table.
  order_id: string;
  purchase_id: string;
  developer_payload?: string;
};
