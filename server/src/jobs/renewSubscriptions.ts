import { prisma } from '../lib/prisma';
import { createRecurringPayment, isYookassaConfigured } from '../lib/yookassa';

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly
// After this many days stuck past_due (card keeps failing), stop retrying and downgrade
// instead of charging a dead card forever.
const PAST_DUE_GRACE_DAYS = 3;

async function renewDueSubscriptions() {
  if (!isYookassaConfigured()) return;

  const now = new Date();

  // Active Pro subscriptions whose period just ended — attempt the off-session
  // recurring charge against the payment method saved from the last successful payment
  // (see routes/payments.ts's webhook handler, which stores it).
  const due = await prisma.subscription.findMany({
    where: {
      plan: 'pro',
      status: 'active',
      currentPeriodEnd: { lte: now },
      yookassaPaymentMethodId: { not: null },
    },
  });

  for (const sub of due) {
    try {
      const payment = await createRecurringPayment(sub.ownerId, sub.yookassaPaymentMethodId!);
      if (payment.status === 'succeeded') {
        const currentPeriodEnd = new Date();
        currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
        await prisma.subscription.update({
          where: { ownerId: sub.ownerId },
          data: { status: 'active', currentPeriodEnd, yookassaPaymentId: payment.id },
        });
      } else {
        await prisma.subscription.update({ where: { ownerId: sub.ownerId }, data: { status: 'past_due' } });
      }
    } catch (err) {
      console.error(`Recurring charge failed for owner ${sub.ownerId}:`, err);
      await prisma.subscription.update({ where: { ownerId: sub.ownerId }, data: { status: 'past_due' } });
    }
  }

  // Card kept failing past the grace window — give up and drop to the free plan rather
  // than retrying forever.
  const graceDeadline = new Date(now.getTime() - PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  await prisma.subscription.updateMany({
    where: { status: 'past_due', updatedAt: { lte: graceDeadline } },
    data: { plan: 'free', status: 'canceled' },
  });

  // Owner explicitly canceled (see routes/subscription.ts's /cancel) — they keep Pro
  // access until the period they already paid for actually ends, then drop to free.
  await prisma.subscription.updateMany({
    where: { status: 'canceled', plan: 'pro', currentPeriodEnd: { lte: now } },
    data: { plan: 'free' },
  });
}

// A single long-running Node process (App Platform's `npm run start`) is enough to host
// this as a plain setInterval — no external cron infra needed at this scale.
export function startSubscriptionRenewalJob(): void {
  renewDueSubscriptions().catch((err) => console.error('renewSubscriptions initial run failed:', err));
  setInterval(() => {
    renewDueSubscriptions().catch((err) => console.error('renewSubscriptions failed:', err));
  }, CHECK_INTERVAL_MS);
}
