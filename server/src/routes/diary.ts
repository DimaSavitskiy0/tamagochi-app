import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { BadRequest } from '../lib/errors';
import { assertPetOwnership } from '../lib/ownership';
import { prisma } from '../lib/prisma';
import { serializeDiaryEntry } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const diaryRouter = Router();
diaryRouter.use(requireAuth);

const entryTypeSchema = z.enum(['feeding', 'walk', 'play', 'weight', 'vet', 'medicine']);

const createSchema = z.object({
  pet_id: z.string().min(1),
  entry_type: entryTypeSchema,
  content: z.string().min(1),
  mood_tag: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

diaryRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const petId = String(req.query.petId ?? '');
    if (!petId) throw BadRequest('petId обязателен');
    await assertPetOwnership(petId, req.userId);

    const entries = await prisma.diaryEntry.findMany({ where: { petId }, orderBy: { createdAt: 'desc' } });
    res.json({ entries: entries.map(serializeDiaryEntry) });
  })
);

diaryRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    await assertPetOwnership(body.pet_id, req.userId);

    const entry = await prisma.diaryEntry.create({
      data: {
        petId: body.pet_id,
        ownerId: req.userId,
        entryType: body.entry_type,
        content: body.content,
        moodTag: body.mood_tag ?? null,
        metadata: body.metadata as Prisma.InputJsonValue,
      },
    });

    res.status(201).json({ entry: serializeDiaryEntry(entry) });
  })
);
