import type { Subscription } from '@prisma/client';
import { Router } from 'express';

import { BadRequest } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { serializeSubscription } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

// Applies the same "canceled subscription past its paid period drops to free" rule
// that jobs/renewSubscriptions.ts runs hourly — called inline on every read so a GET
// right after the period ends never shows stale Pro access, without waiting for the
// next job tick.
async function withLazyExpiry(sub: Subscription): Promise<Subscription> {
  if (sub.status === 'canceled' && sub.plan === 'pro' && sub.currentPeriodEnd && sub.currentPeriodEnd <= new Date()) {
    return prisma.subscription.update({ where: { ownerId: sub.ownerId }, data: { plan: 'free' } });
  }
  return sub;
}

// plan/status/trial_ends_at are otherwise read-only for the client, same as the old
// "select only" RLS policy — they only change via routes/payments.ts's webhook handler
// (after independently verifying the payment with YooKassa's API) or the two mutations
// below, which only ever move a subscription *away* from paid access, never toward it.
subscriptionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { ownerId: req.userId } });
    res.json({ subscription: serializeSubscription(await withLazyExpiry(subscription)) });
  })
);

// Stops future auto-renewal (jobs/renewSubscriptions.ts only charges status === 'active')
// but keeps Pro access until the period already paid for ends — standard "cancel"
// semantics, not an immediate downgrade.
subscriptionRouter.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    const existing = await prisma.subscription.findUniqueOrThrow({ where: { ownerId: req.userId } });
    if (existing.plan !== 'pro' || existing.status !== 'active') {
      throw BadRequest('Нет активной подписки для отмены');
    }
    const subscription = await prisma.subscription.update({
      where: { ownerId: req.userId },
      data: { status: 'canceled' },
    });
    res.json({ subscription: serializeSubscription(subscription) });
  })
);

// Undoes a cancellation made by mistake — only meaningful while still within the paid
// period and with a saved card on file; once the period has actually ended the owner
// needs to pay again via POST /payments/create instead (a fresh checkout, possibly with
// a different card).
subscriptionRouter.post(
  '/resume',
  asyncHandler(async (req, res) => {
    const existing = await prisma.subscription.findUniqueOrThrow({ where: { ownerId: req.userId } });
    const stillWithinPaidPeriod = existing.currentPeriodEnd && existing.currentPeriodEnd > new Date();
    if (existing.status !== 'canceled' || existing.plan !== 'pro' || !stillWithinPaidPeriod || !existing.yookassaPaymentMethodId) {
      throw BadRequest('Подписку нельзя возобновить — оформите её заново');
    }
    const subscription = await prisma.subscription.update({
      where: { ownerId: req.userId },
      data: { status: 'active' },
    });
    res.json({ subscription: serializeSubscription(subscription) });
  })
);
