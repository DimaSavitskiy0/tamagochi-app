import AsyncStorage from '@react-native-async-storage/async-storage';

// Replaces lib/supabase.ts. If EXPO_PUBLIC_API_URL isn't set, the app runs fully offline
// on mock data — every hook already branches on this flag exactly like it branched on
// isSupabaseConfigured before, so that whole demo-mode code path is untouched.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
export const isBackendConfigured = Boolean(API_URL);

const ACCESS_TOKEN_KEY = 'lapgo.accessToken';
const REFRESH_TOKEN_KEY = 'lapgo.refreshToken';
// Last known user/pet, so a cold start without internet still shows the owner's own
// account and pet instead of logging them out / falling back to the mock pet. Wiped
// together with the tokens on sign-out.
export const CACHED_USER_KEY = 'lapgo.cachedUser';
export const CACHED_PET_KEY = 'lapgo.cachedPet';

// React Native's fetch has no timeout at all on Android — on a "connected but dead"
// network (weak mobile signal, captive Wi-Fi) a request would spin forever.
const REQUEST_TIMEOUT_MS = 15000;
const NETWORK_ERROR_MESSAGE = 'Нет подключения к интернету. Проверьте сеть и попробуйте ещё раз.';

export type ApiUser = { id: string; email: string; firstName: string | null; lastName: string | null; phone: string | null };
export type AuthTokens = { accessToken: string; refreshToken: string };

let accessToken: string | null = null;
let refreshToken: string | null = null;

// AuthProvider subscribes to this to flip isAuthenticated → false when a refresh fails
// (refresh token expired/revoked) — there's no other way to notice that from outside
// the request() call where it happens.
const sessionExpiredListeners = new Set<() => void>();
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

export async function restoreTokens(): Promise<AuthTokens | null> {
  const [storedAccess, storedRefresh] = await Promise.all([
    AsyncStorage.getItem(ACCESS_TOKEN_KEY),
    AsyncStorage.getItem(REFRESH_TOKEN_KEY),
  ]);
  if (!storedAccess || !storedRefresh) return null;
  accessToken = storedAccess;
  refreshToken = storedRefresh;
  return { accessToken: storedAccess, refreshToken: storedRefresh };
}

export async function setTokens(tokens: AuthTokens | null): Promise<void> {
  accessToken = tokens?.accessToken ?? null;
  refreshToken = tokens?.refreshToken ?? null;
  if (tokens) {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, tokens.accessToken],
      [REFRESH_TOKEN_KEY, tokens.refreshToken],
    ]);
  } else {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, CACHED_USER_KEY, CACHED_PET_KEY]);
  }
}

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function rawRequest(path: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${API_URL}${path}`, { ...init, signal: controller.signal });
  } catch {
    // Status 0 = never reached the server (offline, DNS failure, timeout). fetch
    // itself rejects with an English "Network request failed" / AbortError — never
    // something to show the user as-is.
    throw new ApiRequestError(0, NETWORK_ERROR_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  const response = await rawRequest('/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  // Only an explicit rejection of the refresh token means the session is over. A 502
  // while the server restarts must not log everyone out — surface it as an error instead.
  if (response.status >= 500) {
    throw new ApiRequestError(response.status, 'Сервер временно недоступен. Попробуйте ещё раз через пару минут.');
  }
  if (!response.ok) return false;
  const data = (await response.json()) as AuthTokens;
  await setTokens(data);
  return true;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
};

// Every hook goes through this — attaches the bearer token, retries once on 401 by
// silently refreshing (mirrors supabase-js's autoRefreshToken), and throws a plain
// Error with the server's message on failure so callers can surface it directly.
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const doFetch = () =>
    rawRequest(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }, timeoutMs);

  let response = await doFetch();

  if (response.status === 401 && auth && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.Authorization = `Bearer ${accessToken}`;
      response = await doFetch();
    } else {
      await setTokens(null);
      sessionExpiredListeners.forEach((listener) => listener());
    }
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}) as { error?: string });
    // 502/503/504 come from the reverse proxy when the API itself is down — a raw
    // "Ошибка запроса (502)" reads like a broken button, so say what's actually going on.
    const fallback =
      response.status >= 500
        ? 'Сервер временно недоступен. Попробуйте ещё раз через пару минут.'
        : `Ошибка запроса (${response.status})`;
    throw new ApiRequestError(response.status, data.error ?? fallback);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  signUp: (email: string, password: string, consent: boolean) =>
    request<{ user: ApiUser } & AuthTokens>('/auth/sign-up', {
      method: 'POST',
      body: { email, password, consent },
      auth: false,
    }),
  signIn: (email: string, password: string) =>
    request<{ user: ApiUser } & AuthTokens>('/auth/sign-in', { method: 'POST', body: { email, password }, auth: false }),
  signOut: () => request<void>('/auth/sign-out', { method: 'POST', body: { refreshToken }, auth: false }),
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', { method: 'POST', body: { email }, auth: false }),
  resetPassword: (email: string, code: string, newPassword: string) =>
    request<void>('/auth/reset-password', { method: 'POST', body: { email, code, newPassword }, auth: false }),
  me: () => request<{ user: ApiUser }>('/auth/me'),
  updateMe: (profile: { firstName: string; lastName: string; phone: string; email: string }) =>
    request<{ user: ApiUser }>('/auth/me', { method: 'PATCH', body: profile }),
  updatePushToken: (token: string | null) =>
    request<void>('/auth/push-token', { method: 'PATCH', body: { token } }),
  // Exists purely to verify RuStore Console Send API credentials + a real device's
  // token work end-to-end — not called by any app feature yet.
  sendTestPush: () => request<void>('/auth/send-test-push', { method: 'POST' }),

  getMyPet: () => request<{ pet: unknown }>('/pets/mine'),
  patchPet: (id: string, patch: Record<string, unknown>) =>
    request<{ pet: unknown }>(`/pets/${id}`, { method: 'PATCH', body: patch }),
  getAiTip: (petId: string, refresh?: boolean) =>
    // LLM generation on the server can take well over the default 15s.
    request<{ tip: string }>(`/pets/${petId}/ai-tip${refresh ? '?refresh=1' : ''}`, { timeoutMs: 60000 }),

  getDiaryEntries: (petId: string) => request<{ entries: unknown[] }>(`/diary-entries?petId=${petId}`),
  addDiaryEntry: (input: Record<string, unknown>) =>
    request<{ entry: unknown }>('/diary-entries', { method: 'POST', body: input }),

  getReminders: (petId: string) => request<{ reminders: unknown[] }>(`/reminders?petId=${petId}`),
  addReminder: (input: Record<string, unknown>) =>
    request<{ reminder: unknown }>('/reminders', { method: 'POST', body: input }),
  patchReminder: (id: string, patch: Record<string, unknown>) =>
    request<{ reminder: unknown }>(`/reminders/${id}`, { method: 'PATCH', body: patch }),

  getPetStatSnapshots: (petId: string) => request<{ snapshots: unknown[] }>(`/pet-stat-snapshots?petId=${petId}`),

  getPetEvents: (petId: string) => request<{ events: unknown[] }>(`/pet-events?petId=${petId}`),
  addPetEvent: (input: Record<string, unknown>) => request<{ event: unknown }>('/pet-events', { method: 'POST', body: input }),
  deletePetEvent: (id: string) => request<void>(`/pet-events/${id}`, { method: 'DELETE' }),

  // Subscription status (plan/status/trialEndsAt) is entirely driven by RuStore Pay's
  // server webhook (see server/src/routes/payments.ts) — the client only ever reads it.
  getSubscription: () => request<{ subscription: unknown }>('/subscription'),
  // Cancels at period end via RuStore's Public API — status here doesn't flip
  // immediately, the webhook above updates it once the period actually ends. The
  // purchase itself still only happens through the native RuStore Pay SDK (see
  // lib/rustorePay.ts) or inside the RuStore app, not through this API.
  cancelSubscription: () => request<void>('/subscription/cancel', { method: 'POST' }),

  recordAppOpen: () => request<{ stats: unknown }>('/stats/app-open', { method: 'POST' }),
};
