import cors from 'cors';
import express from 'express';

import { env } from './lib/env';
import { scheduleRustoreSubscriptionSync } from './jobs/syncRustoreSubscriptions';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { diaryRouter } from './routes/diary';
import { paymentsRouter } from './routes/payments';
import { petEventsRouter } from './routes/petEvents';
import { petStatSnapshotsRouter } from './routes/petStatSnapshots';
import { petsRouter } from './routes/pets';
import { remindersRouter } from './routes/reminders';
import { statsRouter } from './routes/stats';
import { subscriptionRouter } from './routes/subscription';

const app = express();

app.use(cors({ origin: env.corsOrigin }));
// RuStore's webhook body carries its own AES-256-GCM encrypted payload field (see
// lib/rustorePay.ts) rather than a raw-body HMAC signature, so plain JSON parsing is
// fine for every route including the webhook.
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/pets', petsRouter);
app.use('/diary-entries', diaryRouter);
app.use('/reminders', remindersRouter);
app.use('/pet-stat-snapshots', petStatSnapshotsRouter);
app.use('/pet-events', petEventsRouter);
app.use('/subscription', subscriptionRouter);
app.use('/payments', paymentsRouter);
app.use('/stats', statsRouter);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`lapgo-server listening on port ${env.port}`);
});

// No-op if RuStore Public API isn't configured (RUSTORE_API_TOKEN/RUSTORE_API_KEY_ID) —
// see jobs/syncRustoreSubscriptions.ts.
scheduleRustoreSubscriptionSync();
