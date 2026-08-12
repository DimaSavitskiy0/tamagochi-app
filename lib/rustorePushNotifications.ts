import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';

// Thin wrapper around RuStore's native Push SDK (RustorePushClient), hand-authored from
// rustore.ru/help/sdk/push-notifications/react/2-1-1 — same reasoning as
// lib/rustorePay.ts: no exported TS types ship with the package, so this documents the
// exact shape we actually use rather than `any`-typing the whole module.
//
// IMPORTANT — same caveat as lib/rustorePay.ts: this only becomes real once the app is
// built with `expo prebuild`/EAS Build (native module, not usable in Expo Go/web), and
// registration in RuStore Console (Push-уведомления → Проекты) exists with a matching
// project id (see plugins/withRuStorePush.js). Until then isRustorePushAvailable()
// returns false and every call below rejects with a clear error instead of crashing.
//
// This module only gets the device its own push token and hands it to the caller (see
// contexts/AuthProvider.tsx, which PATCHes it to the server) — it does not send
// anything. Actually sending a push still needs a separate call to RuStore's own
// server-side Send API (rustore.ru/help — "Отправка push-уведомлений (API)"), not
// implemented yet.

const { RustorePushClient } = NativeModules as {
  RustorePushClient?: Record<string, (...args: unknown[]) => Promise<unknown>>;
};

export function isRustorePushAvailable(): boolean {
  return Platform.OS === 'android' && Boolean(RustorePushClient);
}

function notAvailable(): never {
  throw new Error(
    'RuStore Push SDK недоступен — приложение запущено без нативного модуля (Expo Go/веб-превью, iOS, или сборка ещё не подключена к RuStore Console). См. server/README.md.'
  );
}

// Android 13+ requires this at runtime in addition to the manifest permission the SDK
// adds automatically — see the docs section this mirrors.
export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (Platform.Version < 33) return true; // POST_NOTIFICATIONS only exists from API 33
  try {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
      title: 'Разрешение на показ уведомлений',
      message: 'Приложению необходимо разрешение на показ уведомлений',
      buttonNeutral: 'Спросить меня позже',
      buttonNegative: 'Отменить',
      buttonPositive: 'OK',
    });
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

// True only when the RuStore app (or another distributor) is installed and reachable —
// checkPushAvailability itself throws/rejects rather than returning false on some
// failure modes per the docs, so this normalizes to a plain boolean.
export async function checkPushAvailability(): Promise<boolean> {
  if (!isRustorePushAvailable()) return false;
  try {
    return (await RustorePushClient!.checkPushAvailability()) as boolean;
  } catch {
    return false;
  }
}

// Creates (if needed) and returns the current push token for this device. Null if the
// SDK isn't available here (rather than throwing) — callers just skip registering.
export async function getRustorePushToken(): Promise<string | null> {
  if (!isRustorePushAvailable()) return null;
  try {
    return (await RustorePushClient!.getToken()) as string;
  } catch {
    return null;
  }
}

export async function deleteRustorePushToken(): Promise<void> {
  if (!isRustorePushAvailable()) return;
  try {
    await RustorePushClient!.deleteToken();
  } catch {
    // Best-effort — if this fails the token just goes stale on RuStore's side, same as
    // an uninstalled app would.
  }
}

// Only meaningful after createPushEmitter() — matches the SDK's own two-step pattern
// (docs: "Для создания эмиттера вызовите..."). Not called automatically by this module
// since not every screen needs live push events; call explicitly where needed.
export function createPushEmitter(): void {
  if (!isRustorePushAvailable()) return notAvailable();
  RustorePushClient!.createPushEmitter();
}

export function removePushEmitter(): void {
  if (!isRustorePushAvailable()) return;
  RustorePushClient!.removePushEmitter();
}

export const PushEvents = {
  ON_NEW_TOKEN: 'ON_NEW_TOKEN',
  ON_MESSAGE_RECEIVED: 'ON_MESSAGE_RECEIVED',
  ON_DELETED_MESSAGES: 'ON_DELETED_MESSAGES',
  ON_ERROR: 'ON_ERROR',
} as const;

export type RustoreRemoteMessage = {
  messageId?: string;
  priority?: number;
  ttl?: number;
  from: string;
  collapseKey?: string;
  data?: Record<string, string>;
  notification?: { title?: string; body: string; imageUrl?: string };
};

// Only constructed when the native module exists — matches lib/rustorePay.ts's pattern
// for the same reason (NativeEventEmitter() with no native module warns/throws on some
// RN versions).
export const rustorePushEventEmitter = isRustorePushAvailable() ? new NativeEventEmitter() : null;
