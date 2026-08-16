import { Router } from 'express';

import { ApiError, BadRequest } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { cancelSubscription, isRustoreApiConfigured } from '../lib/rustoreApi';
import { serializeSubscription } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

// plan/status/trial_ends_at are read-only for the client, same as the old "select only"
// RLS policy — they only ever change via routes/payments.ts's RuStore webhook handler.
// No lazy-expiry here anymore: RuStore Pay owns the whole billing lifecycle (recurring
// charges, grace/hold retries, cancellation) and tells us the current status directly
// through the webhook, unlike the old YooKassa flow where we tracked currentPeriodEnd
// ourselves and had to expire it locally.
subscriptionRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { ownerId: req.userId } });
    res.json({ subscription: serializeSubscription(subscription) });
  })
);

// Cancels at the end of the current billing period via RuStore's Public API — mirrors
// what the user could otherwise only do inside the RuStore app itself. Doesn't touch
// subscriptions.status here: RuStore's own webhook (routes/payments.ts) is still the
// only writer of that, arriving later once the period actually ends.
subscriptionRouter.post(
  '/cancel',
  asyncHandler(async (req, res) => {
    if (!isRustoreApiConfigured()) {
      throw new ApiError(503, 'Отмена подписки из приложения временно недоступна, отмените в приложении RuStore');
    }
    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { ownerId: req.userId } });
    if (subscription.plan !== 'pro' || subscription.status !== 'active') {
      throw BadRequest('Нет активной платной подписки для отмены');
    }
    if (!subscription.rustorePurchaseId) {
      throw BadRequest('Не найден идентификатор покупки RuStore для этой подписки');
    }
    await cancelSubscription(subscription.rustorePurchaseId);
    res.status(204).send();
  })
);
