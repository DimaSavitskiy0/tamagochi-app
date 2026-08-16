import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { RUSTORE_PRO_PRODUCT_CODE } from '@/constants/rustore';
import { useAuth } from '@/contexts/AuthProvider';
import { api, isBackendConfigured } from '@/lib/api';
import { isRustorePayAvailable, purchase, RuStoreUtils } from '@/lib/rustorePay';
import type { Subscription } from '@/types/database';

// A Context, not a plain hook, on purpose — both app/(tabs)/_layout.tsx (PaywallGate)
// and app/(tabs)/profile.tsx read subscription state. A plain hook would give each call
// site its own independent poll loop (two GET /subscription every 30s instead of one)
// and its own independent fast-poll-after-checkout timer, with no way for one to see
// the other's state. This mirrors the PetProvider/AuthProvider pattern already used
// elsewhere in the app.

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
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const BACKGROUND_POLL_MS = 30_000;
const FAST_POLL_MS = 3_000;
const FAST_POLL_DURATION_MS = 2 * 60_000;

type SubscriptionContextValue = {
  subscription: Subscription;
  isPro: boolean;
  isTrialExpired: boolean;
  isLocked: boolean;
  loading: boolean;
  toggleMockPlan: () => void;
  startCheckout: () => Promise<{ error: string | null }>;
  startingCheckout: boolean;
  checkoutError: string | null;
  cancelSubscription: () => Promise<{ error: string | null }>;
  cancelingSubscription: boolean;
  openSubscriptionManagement: () => Promise<{ error: string | null }>;
};

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { ownerId } = useAuth();
  const [subscription, setSubscription] = useState<Subscription>(DEFAULT_SUBSCRIPTION);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [startingCheckout, setStartingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [cancelingSubscription, setCancelingSubscription] = useState(false);
  const subscriptionRef = useRef(subscription);
  subscriptionRef.current = subscription;
  // Tracks the fast-poll-after-checkout interval so it can be torn down if this
  // provider unmounts (sign-out, session change) mid-poll — previously (as a plain
  // hook) this interval had no cleanup path at all and would keep firing after unmount.
  const fastIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

    // No realtime push from the server — RuStore's webhook (server/src/routes/payments.ts)
    // updates our DB, but the client only learns about it by polling. A lightweight
    // background poll catches a purchase confirmed while the app was backgrounded (RuStore's
    // own purchase sheet is a separate native screen, not something we navigate away for),
    // without needing a persistent connection for something this rare.
    const interval = setInterval(refresh, BACKGROUND_POLL_MS);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
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

  // Starts a purchase through RuStore's native Pay SDK (see lib/rustorePay.ts) — no
  // server round-trip to create anything first, unlike the old YooKassa redirect flow.
  // orderId is set to the owner's own user id so the server webhook can map the
  // resulting SUBSCRIPTION_EVENT back to this owner without a separate lookup. Once
  // RuStore confirms the purchase, its webhook flips subscriptions.plan/status
  // server-side — the fast poll below just picks that up as soon as it lands.
  const startCheckout = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isBackendConfigured) {
      toggleMockPlan();
      return { error: null };
    }
    if (!isRustorePayAvailable()) {
      const message =
        'Оплата пока недоступна в этой сборке (нужна сборка с подключённым RuStore Pay SDK — см. server/README.md).';
      setCheckoutError(message);
      return { error: message };
    }
    if (!ownerId) {
      const message = 'Не удалось определить аккаунт для оплаты';
      setCheckoutError(message);
      return { error: message };
    }

    setStartingCheckout(true);
    setCheckoutError(null);
    try {
      const result = await purchase({ productId: RUSTORE_PRO_PRODUCT_CODE, orderId: ownerId });
      if ('errorCode' in result) {
        const message = result.errorMessage ?? `Не удалось оформить подписку (${result.errorCode})`;
        setCheckoutError(message);
        return { error: message };
      }

      if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
      const deadline = Date.now() + FAST_POLL_DURATION_MS;
      fastIntervalRef.current = setInterval(async () => {
        if (subscriptionRef.current.plan === 'pro' || Date.now() > deadline) {
          if (fastIntervalRef.current) clearInterval(fastIntervalRef.current);
          fastIntervalRef.current = null;
          return;
        }
        await refresh();
      }, FAST_POLL_MS);

      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось оформить подписку. Попробуйте ещё раз.';
      setCheckoutError(message);
      return { error: message };
    } finally {
      setStartingCheckout(false);
    }
  }, [ownerId, refresh, toggleMockPlan]);

  // Cancels at period end via our own server, which in turn calls RuStore's Public API
  // (see server/src/routes/subscription.ts) — status doesn't flip here immediately, the
  // background poll above picks up the change once RuStore's webhook lands. If the
  // server isn't configured for this (RUSTORE_API_TOKEN missing), it 503s and the caller
  // should fall back to openSubscriptionManagement below.
  const cancelSubscription = useCallback(async (): Promise<{ error: string | null }> => {
    setCancelingSubscription(true);
    try {
      await api.cancelSubscription();
      await refresh();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Не удалось отменить подписку' };
    } finally {
      setCancelingSubscription(false);
    }
  }, [refresh]);

  // RuStore — not our server, as a fallback — owns cancellation/auto-renewal (same model
  // as Google Play/App Store subscriptions): the user can always manage it from inside
  // the RuStore app itself too. This just opens RuStore; there's nothing for our own API
  // to mutate here.
  const openSubscriptionManagement = useCallback(async (): Promise<{ error: string | null }> => {
    if (!isRustorePayAvailable()) {
      return { error: 'Недоступно в этой сборке — откройте приложение RuStore вручную.' };
    }
    try {
      await RuStoreUtils.openRuStore();
      return { error: null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Не удалось открыть RuStore' };
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
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
        cancelingSubscription,
        openSubscriptionManagement,
      }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
