import { env } from './env';

// Sends a push through RuStore's universal Send API (rustore.ru/help/sdk/
// general-push-notifications/send-push-notifications/api) to one or more specific
// device tokens (as opposed to the sibling /v1/send/topic endpoint, which broadcasts to
// everyone subscribed to a topic — not what per-user notifications like "ваш платёж не
// прошёл" need).
//
// This is a one-way send — RuStore doesn't confirm delivery to the device, only that it
// accepted the request. A token can go stale (app uninstalled, RuStore signed out) with
// no notice beyond a PROVIDER_ERROR on a later send; there's no proactive cleanup here.
const SEND_URL = 'https://vkpns-universal.rustore.ru/v1/send';

export function isRustorePushSendConfigured(): boolean {
  return Boolean(env.rustorePushProjectId && env.rustorePushAuthToken);
}

type SendPushInput = {
  tokens: string[];
  title: string;
  body: string;
  imageUrl?: string;
  // Arbitrary key/value payload the client can read from the notification's data field
  // (e.g. to deep-link somewhere specific) — see message.data in the API docs.
  data?: Record<string, string>;
};

type RustoreSendSuccess = { status: 'OK' };
type RustoreSendError = { status: string; code: number; errors: string[] };

export class RustorePushSendError extends Error {
  code: number;
  errors: string[];
  constructor(body: RustoreSendError) {
    super(`RuStore push send failed (${body.code}): ${body.errors.join('; ')}`);
    this.code = body.code;
    this.errors = body.errors;
  }
}

// Fire-and-forget from the caller's point of view — throws RustorePushSendError on a
// non-2xx response (validation error, bad token, etc.) so callers can decide whether to
// swallow it (e.g. a best-effort reminder push shouldn't fail the request that
// triggered it) or surface it (e.g. an explicit "send me a test push" action).
export async function sendRustorePush(input: SendPushInput): Promise<void> {
  if (!isRustorePushSendConfigured()) {
    throw new Error('RuStore Push Send API is not configured (RUSTORE_PUSH_PROJECT_ID/RUSTORE_PUSH_AUTH_TOKEN)');
  }
  if (input.tokens.length === 0) return;

  const response = await fetch(SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      providers: {
        rustore: { project_id: env.rustorePushProjectId, auth_token: env.rustorePushAuthToken },
      },
      tokens: { rustore: input.tokens },
      message: {
        notification: { title: input.title, body: input.body, ...(input.imageUrl && { image: input.imageUrl }) },
        ...(input.data && { data: input.data }),
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as RustoreSendError | null;
    if (body) throw new RustorePushSendError(body);
    throw new Error(`RuStore push send failed: HTTP ${response.status}`);
  }
}
