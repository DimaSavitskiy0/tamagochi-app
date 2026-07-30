import { useCallback, useEffect, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';

import { api, isBackendConfigured } from '@/lib/api';
import type { Subscription } from '@/types/database';

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const DEFAULT_SUBSCRIPTION: Subscription = {
  id: 'local-subscription',
  owner_id: 'local',
  plan: 'free',
  status: 'active',
  current_period_end: null,
  trial_ends_at: addDays(new Date(), 7).toISOString(),
  yookassa_payment_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const BACKGROUND_POLL_MS = 30_000;
const FAST_POLL_MS = 3_000;
const FAST_POLL_DURATION_MS = 2 * 60_000;

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [updatingSubscription, setUpdatingSubscription] = useState(false);
  const [subscriptionActionError, setSubscriptionActionError] = useState<string | null>(null);
  const subscriptionRef = useRef(subscription);
  subscriptionRef.current = subscription;

  const refresh = useCallback(async () => {
    if (!isBackendConfigured) return;
    try {
      const { subscription: fetched } = await api.getSubscription();
      setSubscription(fetched as Subscription);
    } catch {
      // A transient poll failure isn't worth surfacing — the next tick tries again.
    }
  }, []);

  useEffect(() => {
    if (!isBackendConfigured) return;

    let isMounted = true;
    (async () => {
      await refresh();
      if (isMounted) setLoading(false);
    })();

    // No realtime subscription server-side (see server/src/routes/payments.ts) — a
    // lightweight background poll catches a payment confirmed from another device or a
    // slow webhook, without needing a persistent connection for something this rare.
    const interval = setInterval(refresh, BACKGROUND_POLL_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refresh]);

  const isPro = subscription.plan === 'pro' && subscription.status === 'active';
  const isTrialExpired = Date.now() >= new Date(subscription.trial_ends_at).getTime();
  // Gates the whole app via PaywallModal once the 7-day trial has run out with no
  // upgrade — only meaningful once a real backend exists to enforce it; offline demo
  // mode has no trial to expire.
  const isLocked = isBackendConfigured && !isPro && isTrialExpired;

  // Demo-only toggle for offline mode — there's no payment processor wired up there,
  // this just lets the free/pro UI states be inspected without one.
  const toggleMockPlan = useCallback(() => {
    if (isBackendConfigured) return;
    setSubscription((prev) => ({
      ...prev,
      plan: prev.plan === 'pro' ? 'free' : 'pro',
      updated_at: new Date().toISOString(),
    }));
  }, []);

  // Creates a real YooKassa payment via the server (which holds the secret key) and
  // opens the hosted checkout page. Once the browser closes, a burst of fast polling
  // picks up the payment as soon as the webhook confirms it server-side — no
  // client-side "mark as paid".
  const startCheckout = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isBackendConfigured) {
      toggleMockPlan();
      return { error: null };
    }

    setStartingCheckout(true);
    setCheckoutError(null);
    try {
      const { confirmationUrl } = await api.createPayment();
      if (!confirmationUrl) {
        const message = 'Не удалось создать платёж. Попробуйте ещё раз.';
        setCheckoutError(message);
        return { error: message };
      }
      await WebBrowser.openBrowserAsync(confirmationUrl);

      const deadline = Date.now() + FAST_POLL_DURATION_MS;
      const fastInterval = setInterval(async () => {
        if (subscriptionRef.current.plan === 'pro' || Date.now() > deadline) {
          clearInterval(fastInterval);
          return;
        }
        await refresh();
      }, FAST_POLL_MS);

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать платёж. Попробуйте ещё раз.';
      setCheckoutError(message);
      return { error: message };
    } finally {
      setStartingCheckout(false);
    }
  }, [refresh, toggleMockPlan]);

  // Stops future auto-renewal (see server/src/jobs/renewSubscriptions.ts) but keeps Pro
  // access until the paid period ends — never an immediate downgrade.
  const cancelSubscription = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isBackendConfigured) {
      toggleMockPlan();
      return { error: null };
    }
    setUpdatingSubscription(true);
    setSubscriptionActionError(null);
    try {
      const { subscription: updated } = await api.cancelSubscription();
      setSubscription(updated as Subscription);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось отменить подписку';
      setSubscriptionActionError(message);
      return { error: message };
    } finally {
      setUpdatingSubscription(false);
    }
  }, [toggleMockPlan]);

  // Undoes a cancellation made within the still-paid period — the server rejects this
  // once the period has actually ended, at which point startCheckout is the only way
  // back in.
  const resumeSubscription = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isBackendConfigured) {
      toggleMockPlan();
      return { error: null };
    }
    setUpdatingSubscription(true);
    setSubscriptionActionError(null);
    try {
      const { subscription: updated } = await api.resumeSubscription();
      setSubscription(updated as Subscription);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось возобновить подписку';
      setSubscriptionActionError(message);
      return { error: message };
    } finally {
      setUpdatingSubscription(false);
    }
  }, [toggleMockPlan]);

  return {
    subscription,
    isPro,
    isTrialExpired,
    isLocked,
    loading,
    toggleMockPlan,
    startCheckout,
    startingCheckout,
    checkoutError,
    cancelSubscription,
    resumeSubscription,
    updatingSubscription,
    subscriptionActionError,
  };
}
