import { Router } from 'express';

import { BadRequest } from '../lib/errors';
import { assertPetOwnership } from '../lib/ownership';
import { prisma } from '../lib/prisma';
import { serializePetStatSnapshot } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const petStatSnapshotsRouter = Router();
petStatSnapshotsRouter.use(requireAuth);

// Read-only — rows are only ever written server-side from routes/pets.ts's PATCH
// handler whenever hunger/mood/health actually change, same as before.
petStatSnapshotsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const petId = String(req.query.petId ?? '');
    if (!petId) throw BadRequest('petId обязателен');
    await assertPetOwnership(petId, req.userId);

    const snapshots = await prisma.petStatSnapshot.findMany({ where: { petId }, orderBy: { recordedAt: 'asc' } });
    res.json({ snapshots: snapshots.map(serializePetStatSnapshot) });
  })
);
