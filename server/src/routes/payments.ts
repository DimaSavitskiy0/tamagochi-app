import { Router } from 'express';

import {
  decryptRustoreNotification,
  isRustorePayConfigured,
  type RustoreDecryptedPayload,
  type RustoreNotificationBody,
  type RustoreSubscriptionEventData,
} from '../lib/rustorePay';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/errorHandler';

export const paymentsRouter = Router();

// Maps a RuStore subscription status straight onto our own plan/status vocabulary.
// Unlike the old YooKassa flow, RuStore itself owns the whole billing lifecycle
// (recurring charges, grace/hold retries, cancellation) — we just mirror its status,
// we never compute currentPeriodEnd or attempt our own retries.
function applyStatus(status_new: RustoreSubscriptionEventData['status_new']): { plan: string; status: string } {
  switch (status_new) {
    case 'ACTIVE':
      return { plan: 'pro', status: 'active' };
    case 'PAUSED':
      // Hold period — a charge failed and access is suspended while RuStore keeps
      // retrying. Kept as 'past_due' so isPro (plan==='pro' && status==='active')
      // correctly locks the app, same gating rule as before.
      return { plan: 'pro', status: 'past_due' };
    case 'CLOSED':
    case 'TERMINATED':
    default:
      return { plan: 'free', status: 'canceled' };
  }
}

// Public — RuStore calls this directly, no bearer token. Register this URL in RuStore
// Console (Monetization → Server notifications) as both the real and sandbox/test
// notification endpoint (or two separate URLs — either works, see server/README.md).
//
// RuStore's own delivery-guarantee doc says it retries on anything but a 200 within
// 3 seconds — so this always resolves fast and only ever 400s on a payload that's
// genuinely undecryptable/malformed, never on "we don't recognize this owner" (still 200,
// so RuStore doesn't hammer us forever for an event we can't act on).
paymentsRouter.post(
  '/rustore-webhook',
  asyncHandler(async (req, res) => {
    if (!isRustorePayConfigured()) {
      res.status(503).json({ error: 'RuStore Pay webhook secret not configured' });
      return;
    }

    const body = req.body as Partial<RustoreNotificationBody>;
    if (!body?.payload) {
      res.status(400).json({ error: 'Missing payload' });
      return;
    }

    let payload: RustoreDecryptedPayload;
    try {
      payload = JSON.parse(decryptRustoreNotification(body.payload)) as RustoreDecryptedPayload;
    } catch (err) {
      console.error('Failed to decrypt/parse RuStore notification:', err);
      res.status(400).json({ error: 'Bad payload' });
      return;
    }

    if (payload.notification_type === 'TEST_EVENT' || payload.notification_type === 'TEST_EVENT_SANDBOX') {
      // Console's "Check" button — nothing to apply, just confirm we're reachable.
      res.json({ received: true });
      return;
    }

    if (
      payload.notification_type === 'SUBSCRIPTION_EVENT' ||
      payload.notification_type === 'SUBSCRIPTION_EVENT_SANDBOX'
    ) {
      const data = JSON.parse(payload.data) as RustoreSubscriptionEventData;
      // order_id is set by the client to the owner's own user id when it calls
      // purchase({ orderId: ownerId, ... }) — see lib/rustorePay.ts on the client.
      const ownerId = data.order_id;

      const owner = await prisma.subscription.findUnique({ where: { ownerId } });
      if (!owner) {
        // Unknown order_id (e.g. a stray sandbox event, or order_id wasn't a real user
        // id for some reason) — acknowledge so RuStore stops retrying, nothing to apply.
        console.warn(`RuStore subscription event for unknown owner_id order_id=${ownerId}`);
        res.json({ received: true });
        return;
      }

      await prisma.subscription.update({
        where: { ownerId },
        data: { ...applyStatus(data.status_new), rustorePurchaseId: data.purchase_id },
      });

      res.json({ received: true });
      return;
    }

    // INVOICE_STATUS(_SANDBOX) — one-time product purchases. Not used by this app (Pro
    // is a subscription only), acknowledge and ignore.
    res.json({ received: true });
  })
);
