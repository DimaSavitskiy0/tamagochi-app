import { Router } from 'express';

import { prisma } from '../lib/prisma';
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
