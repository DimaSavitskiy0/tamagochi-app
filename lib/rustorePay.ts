import { NativeEventEmitter, NativeModules } from 'react-native';

// Thin TypeScript wrapper around RuStore's native Android Pay SDK module
// (`ru.rustore.sdk-wrapper.react-native:pay`, RuStoreReactPayPackage — registered in
// MainApplication.java). Hand-authored from RuStore's own docs (rustore.ru/help/sdk/pay/
// react-native/10-3-1) and the shape of their reference implementation
// (gitflic.ru/project/rustore/react-native-rustore-pay-sdk-example), since there is no
// published npm package — RuStore has you vendor these files into your own project and
// pull the native binary from their own Maven repo (see android/app/build.gradle).
//
// IMPORTANT — this file alone does not make purchases work. It only becomes real once:
//   1. `npx expo prebuild` has generated an android/ folder (this is a native module —
//      it cannot run inside Expo Go or the web preview, only a custom dev client/build).
//   2. android/app/build.gradle has the RuStore Pay dependency + Maven repo added.
//   3. AndroidManifest.xml has console_app_id_value + sdk_pay_scheme_value configured.
//   4. MainApplication.java registers RuStoreReactPayPackage, and MainActivity forwards
//      deeplink intents to it.
//   5. The app has already been uploaded to RuStore Console with the exact same
//      applicationId + keystore signature used for this build.
// None of that is done by this file — see server/README.md §3 for the full checklist.
// Until then, isRustorePayAvailable() returns false and every call below rejects with a
// clear error instead of crashing.

type ProductType = 'CONSUMABLE_PRODUCT' | 'NON_CONSUMABLE_PRODUCT' | 'SUBSCRIPTION';

type ProductPurchaseStatus =
  | 'INVOICE_CREATED'
  | 'CANCELLED'
  | 'PROCESSING'
  | 'REJECTED'
  | 'CONFIRMED'
  | 'REFUNDED'
  | 'REFUNDING'
  | 'EXECUTING'
  | 'EXPIRED'
  | 'PAID'
  | 'REVERSED';

type SubscriptionPurchaseStatus =
  | 'INVOICE_CREATED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PROCESSING'
  | 'REJECTED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'TERMINATED'
  | 'CLOSED';

type PurchaseType = 'ONE_STEP' | 'TWO_STEP' | 'UNDEFINED';
export type PreferredPurchaseType = 'ONE_STEP' | 'TWO_STEP';
export type SdkTheme = 'LIGHT' | 'DARK';

type SubscriptionPeriod =
  | { type: 'MAIN' | 'TRIAL' | 'PROMO'; duration: string; currency: string; price: number }
  | { type: 'GRACE' | 'HOLD'; duration: string };

export type SubscriptionInfo = { periods: SubscriptionPeriod[] };

export type Product = {
  productId: string;
  type: ProductType;
  amountLabel: string;
  price?: number;
  currency: string;
  imageUrl: string;
  title: string;
  description?: string;
  subscriptionInfo?: SubscriptionInfo;
};

export type ProductPurchase = {
  purchaseId: string;
  invoiceId: string;
  orderId?: string;
  purchaseType: PurchaseType;
  status: ProductPurchaseStatus;
  description: string;
  purchaseTime?: string;
  price: number;
  amountLabel: string;
  currency: string;
  developerPayload?: string;
  sandbox: boolean;
  productId: string;
  quantity: number;
  productType: ProductType;
};

export type SubscriptionPurchase = {
  purchaseId: string;
  invoiceId: string;
  orderId?: string;
  purchaseType: PurchaseType;
  status: SubscriptionPurchaseStatus;
  description: string;
  purchaseTime?: string;
  price: number;
  amountLabel: string;
  currency: string;
  developerPayload?: string;
  sandbox: boolean;
  productId: string;
  expirationDate: string;
  gracePeriodEnabled: boolean;
};

export type Purchase = { productPurchase?: ProductPurchase; subscriptionPurchase?: SubscriptionPurchase };

export type PurchaseAvailability = { availability: boolean; cause?: string };

export type ProductPurchaseResult =
  | { purchaseId: string; invoiceId: string; orderId?: string; purchaseType: PurchaseType }
  | { errorCode: string; errorMessage?: string };

type PurchaseParams = { productId: string; orderId?: string; quantity?: number; developerPayload?: string; appUserId?: string; appUserEmail?: string; preferredPurchaseType?: PreferredPurchaseType; sdkTheme?: SdkTheme };

const { RuStoreReactPay } = NativeModules as { RuStoreReactPay?: Record<string, (...args: unknown[]) => Promise<unknown>> };

export function isRustorePayAvailable(): boolean {
  return Boolean(RuStoreReactPay);
}

function notAvailable(): never {
  throw new Error(
    'RuStore Pay SDK недоступен — приложение запущено без нативного модуля (Expo Go/веб-превью, или сборка ещё не подключена к RuStore Console). См. server/README.md §3.'
  );
}

export const RuStoreUtils = {
  async isRuStoreInstalled(): Promise<boolean> {
    if (!RuStoreReactPay) return false;
    return (await RuStoreReactPay.isRuStoreInstalled()) as boolean;
  },
  async openRuStore(): Promise<void> {
    if (!RuStoreReactPay) return notAvailable();
    await RuStoreReactPay.openRuStore();
  },
  async openRuStoreAuthorization(): Promise<void> {
    if (!RuStoreReactPay) return notAvailable();
    await RuStoreReactPay.openRuStoreAuthorization();
  },
  async openRuStoreDownloadInstruction(): Promise<void> {
    if (!RuStoreReactPay) return notAvailable();
    await RuStoreReactPay.openRuStoreDownloadInstruction();
  },
};

export async function getProducts(ids: string[]): Promise<Product[]> {
  if (!RuStoreReactPay) return notAvailable();
  return (await RuStoreReactPay.getProducts(ids)) as Product[];
}

export async function getPurchase(purchaseId: string): Promise<Purchase> {
  if (!RuStoreReactPay) return notAvailable();
  return (await RuStoreReactPay.getPurchase(purchaseId)) as Purchase;
}

export async function getPurchases(params?: { productType?: ProductType; purchaseStatus?: ProductPurchaseStatus | SubscriptionPurchaseStatus }): Promise<Purchase[]> {
  if (!RuStoreReactPay) return notAvailable();
  return (await RuStoreReactPay.getPurchases(params)) as Purchase[];
}

export async function getPurchaseAvailability(): Promise<PurchaseAvailability> {
  if (!RuStoreReactPay) return { availability: false, cause: 'RuStore Pay SDK не подключён в этой сборке' };
  return (await RuStoreReactPay.getPurchaseAvailability()) as PurchaseAvailability;
}

export async function getUserAuthorizationStatus(): Promise<boolean> {
  if (!RuStoreReactPay) return false;
  return (await RuStoreReactPay.getUserAuthorizationStatus()) as boolean;
}

// Starts a one-step purchase (no fund holding) — the only supported flow for
// subscriptions per RuStore's docs. `orderId` should be the owner's own user id so the
// server webhook (server/src/routes/payments.ts) can map the event back to their
// subscription row without a separate lookup.
export async function purchase(params: PurchaseParams): Promise<ProductPurchaseResult> {
  if (!RuStoreReactPay) return notAvailable();
  return (await RuStoreReactPay.purchase({ preferredPurchaseType: 'ONE_STEP', ...params })) as ProductPurchaseResult;
}

// Exposed for completeness (matches the SDK's public surface) — not used for the Pro
// subscription flow, which only supports ONE_STEP per RuStore's own docs.
export async function purchaseTwoStep(params: PurchaseParams): Promise<ProductPurchaseResult> {
  if (!RuStoreReactPay) return notAvailable();
  return (await RuStoreReactPay.purchaseTwoStep(params)) as ProductPurchaseResult;
}

export async function confirmTwoStepPurchase(purchaseId: string, developerPayload?: string): Promise<void> {
  if (!RuStoreReactPay) return notAvailable();
  await RuStoreReactPay.confirmTwoStepPurchase({ purchaseId, developerPayload });
}

export async function cancelTwoStepPurchase(purchaseId: string): Promise<void> {
  if (!RuStoreReactPay) return notAvailable();
  await RuStoreReactPay.cancelTwoStepPurchase(purchaseId);
}

// For the deeplink handling MainActivity.kt/java is documented to call into
// (banking-app redirects for СБП/SberPay) — exposed here only so a future native-side
// integration doc can point at one place; not callable from JS, deeplinks are handled on
// the native side per RuStore's docs.
export const rustorePayEventEmitter = RuStoreReactPay ? new NativeEventEmitter() : null;
