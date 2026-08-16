import { prisma } from '../lib/prisma';
import { getSubscriptionData, isRustoreApiConfigured } from '../lib/rustoreApi';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // раз в сутки

// Safety net alongside routes/payments.ts's webhook, not a replacement for it: the
// webhook is the fast path (near-real-time), this job exists only to catch the rare
// case where a webhook delivery was permanently lost (RuStore retries for up to 36h,
// then gives up) and a subscription that actually expired never got flipped to free.
//
// Deliberately conservative: only acts on the one unambiguous signal RuStore's V4
// subscription-data API gives us (expiryTimeMillis in the past), not on
// paymentState/cancelReason, whose exact semantics for RuStore (vs. the Google Play
// Billing API they're modeled on) aren't confirmed — a false "still active" read here
// just means the next day's run or the webhook catches it; a wrong downgrade would
// wrongly cut off a paying user, so this only ever acts in the safe direction.
export async function runRustoreSubscriptionSync(): Promise<void> {
  if (!isRustoreApiConfigured()) return;

  const proSubscriptions = await prisma.subscription.findMany({
    where: { plan: 'pro', rustorePurchaseId: { not: null } },
  });

  for (const sub of proSubscriptions) {
    try {
      const data = await getSubscriptionData(sub.rustorePurchaseId!);
      if (!data) continue;

      const expiryMs = Number(data.expiryTimeMillis);
      if (Number.isFinite(expiryMs) && expiryMs < Date.now()) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { plan: 'free', status: 'canceled' },
        });
        console.log(
          `[rustore-sync] Подписка ${sub.id} истекла ${new Date(expiryMs).toISOString()} — сброшена на free (вебхук её, похоже, пропустил)`
        );
      }
    } catch (err) {
      // One subscription failing to sync (RuStore hiccup, stale purchaseId, etc.)
      // shouldn't stop the rest of the batch from being checked.
      console.error(`[rustore-sync] Не удалось сверить подписку ${sub.id}:`, err);
    }
  }
}

export function scheduleRustoreSubscriptionSync(): void {
  // Runs once at startup too (not just after the first interval) so a subscription
  // that expired while the server was down/redeploying gets caught promptly.
  runRustoreSubscriptionSync().catch((err) => console.error('[rustore-sync] initial run failed:', err));
  setInterval(() => {
    runRustoreSubscriptionSync().catch((err) => console.error('[rustore-sync] scheduled run failed:', err));
  }, SYNC_INTERVAL_MS);
}
