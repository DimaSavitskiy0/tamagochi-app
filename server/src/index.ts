import cors from 'cors';
import express from 'express';

import { startSubscriptionRenewalJob } from './jobs/renewSubscriptions';
import { env } from './lib/env';
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
// The YooKassa webhook needs the raw body only if we were verifying signatures — we
// verify by re-fetching the payment from YooKassa's API instead (see routes/payments.ts),
// so plain JSON parsing is fine for every route including the webhook.
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
  console.log(`tamagochi-server listening on port ${env.port}`);
});

startSubscriptionRenewalJob();
