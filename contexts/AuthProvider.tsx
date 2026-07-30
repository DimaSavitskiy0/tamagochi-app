import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, isBackendConfigured, onSessionExpired, restoreTokens, setTokens, type ApiUser } from '@/lib/api';

// Offline/guest mode has no real backend session to restore from, so its identity
// (name/phone/email, onboarding state) is persisted here instead — otherwise it would
// reset to nothing on every app restart, unlike the online mode's JWT-backed session.
const GUEST_STATE_KEY = 'tamagochi_guest_state';

type PersistedGuestState = {
  guestProfile: OwnerProfile | null;
  offlineEmail: string | null;
  offlineSignedOut: boolean;
  skipOnboarding: boolean;
};

type AuthResult = {
  error: string | null;
};

type SignUpProfile = {
  firstName: string;
  lastName: string;
  phone: string;
};

/** Owner profile shape used for display/editing. `email` is populated in both online
 * and offline mode — online it's the real account email, offline it's whatever the
 * guest typed on the sign-in screen. */
type OwnerProfile = SignUpProfile & { email?: string };

/** `email` is optional here because the "Добро пожаловать" onboarding step only
 * collects name/phone (the email was already given on the sign-in screen) — the
 * profile-editing screen is the only caller that actually passes a new email. */
type ProfileUpdate = SignUpProfile & { email?: string };

type AuthContextValue = {
  isAuthenticated: boolean;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  /** Creates the account with just credentials — name/phone/pet data are collected right
   * after, by the "Добро пожаловать" onboarding flow, not on the sign-in screen.
   * `consent` must be true (checkbox on the sign-in screen) — the server rejects
   * sign-up without it and records when it was given, per 152-ФЗ. */
  signUp: (email: string, password: string, consent: boolean) => Promise<AuthResult>;
  signOut: () => Promise<void>;
  updateProfile: (profile: ProfileUpdate) => Promise<AuthResult>;
  /** Owner's name — from the backend when configured, or the local guest profile offline. */
  ownerProfile: OwnerProfile | null;
  hasOwnerProfile: boolean;
  /** True right after an offline "Войти" — an existing demo account has nothing new to
   * collect, so the owner/pet onboarding modals should stay out of the way and drop the
   * user straight on the main screen, unlike a fresh "Регистрация". */
  skipOnboarding: boolean;
  /** Bumped on every sign-out/sign-in/sign-up so other providers (e.g. the pet's data)
   * can key off it to force a fresh remount instead of reusing stale state from a
   * previous session/account. */
  sessionEpoch: number;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(isBackendConfigured);
  const [user, setUser] = useState<ApiUser | null>(null);
  // Offline mode has no real backend user to attach a name to, but we still want the
  // "create the owner before the pet" flow to work, so it's kept here instead.
  const [guestProfile, setGuestProfile] = useState<OwnerProfile | null>(null);
  // Offline mode has no real session, so "signed in" is tracked locally instead — defaults
  // to signed-out so the sign-in/registration screen is genuinely the first screen shown,
  // and also so the sign-out button has somewhere real to land.
  const [offlineSignedOut, setOfflineSignedOut] = useState(true);
  // The sign-in screen only collects email/password offline — remembered separately so it
  // can still be shown in the profile once the "Добро пожаловать" step fills in the rest.
  const [offlineEmail, setOfflineEmail] = useState<string | null>(null);
  // Forces PetProvider (and anything else keyed on it) to remount with fresh data on
  // every sign-out/sign-in/sign-up, instead of silently reusing the previous session's pet.
  const [sessionEpoch, setSessionEpoch] = useState(0);
  // Offline "Войти" has no real account to restore, but it also isn't a fresh signup —
  // it should land the user on the main screen like a returning user, not repeat the
  // owner/pet onboarding every time. See OnboardingGate in app/(tabs)/_layout.tsx.
  const [skipOnboarding, setSkipOnboarding] = useState(false);
  // Guards the persist effect below from firing (and clobbering AsyncStorage with
  // defaults) before the initial restore from AsyncStorage has finished.
  const [guestStateRestored, setGuestStateRestored] = useState(false);

  useEffect(() => {
    if (isBackendConfigured) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(GUEST_STATE_KEY);
        if (raw) {
          const saved: PersistedGuestState = JSON.parse(raw);
          setGuestProfile(saved.guestProfile);
          setOfflineEmail(saved.offlineEmail);
          setOfflineSignedOut(saved.offlineSignedOut);
          setSkipOnboarding(saved.skipOnboarding);
        }
      } finally {
        setGuestStateRestored(true);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (isBackendConfigured || !guestStateRestored) return;

    const state: PersistedGuestState = { guestProfile, offlineEmail, offlineSignedOut, skipOnboarding };
    AsyncStorage.setItem(GUEST_STATE_KEY, JSON.stringify(state));
  }, [guestProfile, offlineEmail, offlineSignedOut, skipOnboarding, guestStateRestored]);

  useEffect(() => {
    if (!isBackendConfigured) return;

    (async () => {
      const tokens = await restoreTokens();
      if (!tokens) {
        setLoading(false);
        return;
      }
      try {
        const { user: restoredUser } = await api.me();
        setUser(restoredUser);
      } catch {
        await setTokens(null);
      } finally {
        setLoading(false);
      }
    })();

    // Fires when a request's silent token refresh fails (refresh token expired/revoked)
    // — the equivalent of Supabase's onAuthStateChange emitting a null session.
    return onSessionExpired(() => {
      setUser(null);
      setSessionEpoch((n) => n + 1);
    });
  }, []);

  const signInWithPassword = async (email: string, password: string): Promise<AuthResult> => {
    // No real backend to check credentials against offline, so there's no previous
    // profile/pet to actually restore — but "Войти" implies an existing account, so it
    // should still drop straight onto the main screen instead of repeating onboarding.
    if (!isBackendConfigured) {
      setGuestProfile(null);
      setOfflineEmail(email);
      setOfflineSignedOut(false);
      setSkipOnboarding(true);
      setSessionEpoch((n) => n + 1);
      return { error: null };
    }
    try {
      const result = await api.signIn(email, password);
      await setTokens(result);
      setUser(result.user);
      setSessionEpoch((n) => n + 1);
      return { error: null };
    } catch (err) {
      return { error: errorMessage(err, 'Не удалось войти') };
    }
  };

  const signUp = async (email: string, password: string, consent: boolean): Promise<AuthResult> => {
    if (!consent) {
      return { error: 'Нужно согласие на обработку персональных данных' };
    }
    if (!isBackendConfigured) {
      // guestProfile is explicitly cleared (defensive, in case any stale state survived
      // from a previous session) — the "Добро пожаловать" onboarding gate
      // (hasOwnerProfile === false) then picks this up right after and collects name/phone/pet.
      setGuestProfile(null);
      setOfflineEmail(email);
      setOfflineSignedOut(false);
      setSkipOnboarding(false);
      setSessionEpoch((n) => n + 1);
      return { error: null };
    }
    try {
      const result = await api.signUp(email, password, consent);
      await setTokens(result);
      setUser(result.user);
      setSessionEpoch((n) => n + 1);
      return { error: null };
    } catch (err) {
      return { error: errorMessage(err, 'Не удалось зарегистрироваться') };
    }
  };

  const signOut = async () => {
    if (!isBackendConfigured) {
      setOfflineSignedOut(true);
      // A real sign-out should actually end the session — clear the local guest profile
      // too, so the next sign-in/registration starts the "Добро пожаловать" flow fresh
      // instead of silently reusing the previous person's name and pet.
      setGuestProfile(null);
      setOfflineEmail(null);
      setSkipOnboarding(false);
      setSessionEpoch((n) => n + 1);
      return;
    }
    try {
      await api.signOut();
    } catch {
      // Best-effort — the refresh token row is revoked, if the request fails the token
      // just expires naturally within its TTL. Local sign-out proceeds either way.
    }
    await setTokens(null);
    setUser(null);
    setSessionEpoch((n) => n + 1);
  };

  const updateProfile = async (profile: ProfileUpdate): Promise<AuthResult> => {
    if (!isBackendConfigured) {
      setGuestProfile((prev) => ({ ...prev, ...profile }));
      return { error: null };
    }
    try {
      // The onboarding step (name/phone only) doesn't collect email — fall back to the
      // current one so the server's profileSchema (which requires it) still validates.
      const email = profile.email ?? user?.email ?? '';
      const { user: updatedUser } = await api.updateMe({ ...profile, email });
      setUser(updatedUser);
      return { error: null };
    } catch (err) {
      return { error: errorMessage(err, 'Не удалось сохранить') };
    }
  };

  // With no backend configured yet, there's no real session to gate on — the local
  // offlineSignedOut flag stands in for it, so the app still starts at sign-in.
  const isAuthenticated = isBackendConfigured ? user !== null : !offlineSignedOut;

  const ownerProfile: OwnerProfile | null = isBackendConfigured
    ? user?.firstName && user?.lastName
      ? { firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? '', email: user.email }
      : null
    : guestProfile
      ? { ...guestProfile, email: guestProfile.email ?? offlineEmail ?? undefined }
      : null;
  const hasOwnerProfile = ownerProfile !== null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        loading,
        signInWithPassword,
        signUp,
        signOut,
        updateProfile,
        ownerProfile,
        hasOwnerProfile,
        skipOnboarding,
        sessionEpoch,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
