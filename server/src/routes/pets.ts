import { Router } from 'express';
import { z } from 'zod';

import { generatePetTip, isAiConfigured } from '../lib/ai';
import { ApiError, Forbidden, NotFound } from '../lib/errors';
import { serializePet } from '../lib/serializers';
import { prisma } from '../lib/prisma';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const petsRouter = Router();
petsRouter.use(requireAuth);

const petPatchSchema = z.object({
  name: z.string().min(1).optional(),
  breed: z.string().nullable().optional(),
  age_years: z.number().nullable().optional(),
  species: z.enum(['cat', 'dog', 'rabbit', 'hamster', 'bird', 'fish', 'other']).optional(),
  hunger: z.number().int().min(0).max(100).optional(),
  mood: z.number().int().min(0).max(100).optional(),
  health: z.number().int().min(0).max(100).optional(),
});

// Mirrors contexts/PetProvider.tsx's old select-or-insert effect: the first time a
// signed-up user opens the pet screen there's no row yet, so one is created on the fly
// instead of requiring a separate "create pet" step server-side.
petsRouter.get(
  '/mine',
  asyncHandler(async (req, res) => {
    let pet = await prisma.pet.findFirst({ where: { ownerId: req.userId } });
    if (!pet) {
      pet = await prisma.pet.create({ data: { ownerId: req.userId } });
    }
    res.json({ pet: serializePet(pet) });
  })
);

petsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.pet.findUnique({ where: { id: req.params.id } });
    if (!existing) throw NotFound('Питомец не найден');
    if (existing.ownerId !== req.userId) throw Forbidden();

    const patch = petPatchSchema.parse(req.body);

    const pet = await prisma.pet.update({
      where: { id: existing.id },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.breed !== undefined && { breed: patch.breed }),
        ...(patch.age_years !== undefined && { ageYears: patch.age_years }),
        ...(patch.species !== undefined && { species: patch.species }),
        ...(patch.hunger !== undefined && { hunger: patch.hunger }),
        ...(patch.mood !== undefined && { mood: patch.mood }),
        ...(patch.health !== undefined && { health: patch.health }),
      },
    });

    // Snapshot whenever the vitals actually move, so the diary trend chart has real
    // history to plot instead of just the current instantaneous value — same trigger
    // condition as the old PetProvider.updatePet had for Supabase.
    if (patch.hunger !== undefined || patch.mood !== undefined || patch.health !== undefined) {
      await prisma.petStatSnapshot.create({
        data: { petId: pet.id, ownerId: pet.ownerId, hunger: pet.hunger, mood: pet.mood, health: pet.health },
      });
    }

    res.json({ pet: serializePet(pet) });
  })
);

// In-memory cache keyed by pet id — a fresh call to the Anthropic API on every pet
// screen render would be slow and needlessly expensive for a tip that doesn't need to
// change that often. Resets on server restart, which is fine at this scale.
const AI_TIP_TTL_MS = 6 * 60 * 60 * 1000;
const aiTipCache = new Map<string, { text: string; expiresAt: number }>();

petsRouter.get(
  '/:id/ai-tip',
  asyncHandler(async (req, res) => {
    if (!isAiConfigured()) throw new ApiError(503, 'ИИ-совет пока не настроен на сервере');

    const pet = await prisma.pet.findUnique({ where: { id: req.params.id } });
    if (!pet) throw NotFound('Питомец не найден');
    if (pet.ownerId !== req.userId) throw Forbidden();

    const forceRefresh = req.query.refresh === '1';
    const cached = aiTipCache.get(pet.id);
    if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
      res.json({ tip: cached.text });
      return;
    }

    const recentEntries = await prisma.diaryEntry.findMany({
      where: { petId: pet.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { entryType: true, content: true },
    });

    const text = await generatePetTip({
      name: pet.name,
      breed: pet.breed,
      ageYears: pet.ageYears === null ? null : Number(pet.ageYears),
      hunger: pet.hunger,
      mood: pet.mood,
      health: pet.health,
      recentEntrySummaries: recentEntries.map((e) => `${e.entryType}: ${e.content}`),
    });

    aiTipCache.set(pet.id, { text, expiresAt: Date.now() + AI_TIP_TTL_MS });
    res.json({ tip: text });
  })
);
