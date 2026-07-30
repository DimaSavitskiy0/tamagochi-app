import { Router } from 'express';
import { z } from 'zod';

import { ApiError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { createYookassaPayment, fetchYookassaPayment, isYookassaConfigured } from '../lib/yookassa';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const paymentsRouter = Router();

paymentsRouter.post(
  '/create',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (!isYookassaConfigured()) {
      throw new ApiError(503, 'Оплата пока не настроена на сервере');
    }

    const payment = await createYookassaPayment(req.userId);
    res.json({ confirmationUrl: payment.confirmation?.confirmation_url, paymentId: payment.id });
  })
);

// Public — YooKassa calls this directly, with no bearer token. Register this URL in the
// YooKassa merchant dashboard as the HTTP notification endpoint.
paymentsRouter.post(
  '/webhook',
  asyncHandler(async (req, res) => {
    const body = z.object({ object: z.object({ id: z.string() }) }).safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: 'Missing payment id' });
      return;
    }

    const payment = await fetchYookassaPayment(body.data.object.id);
    const ownerId = payment.metadata?.owner_id;

    if (payment.status !== 'succeeded' || !ownerId) {
      // Not actually paid (or missing metadata) — acknowledge with 200 anyway so
      // YooKassa stops retrying; there's nothing to apply.
      res.json({ received: true });
      return;
    }

    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

    // Saved on both the first (redirect) payment and every recurring charge — harmless
    // to overwrite with the same id on renewals, and picks up a fresh one if the owner
    // ever pays with a different card after a failed renewal.
    const paymentMethodId = payment.payment_method?.id;

    // Idempotent: replaying the same succeeded event just writes the same values again.
    await prisma.subscription.update({
      where: { ownerId },
      data: {
        plan: 'pro',
        status: 'active',
        currentPeriodEnd,
        yookassaPaymentId: payment.id,
        ...(paymentMethodId && { yookassaPaymentMethodId: paymentMethodId }),
      },
    });

    res.json({ received: true });
  })
);
