import { Router } from 'express';
import { z } from 'zod';

import { BadRequest, Forbidden, NotFound } from '../lib/errors';
import { assertPetOwnership } from '../lib/ownership';
import { prisma } from '../lib/prisma';
import { serializePetEvent } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const petEventsRouter = Router();
petEventsRouter.use(requireAuth);

const createSchema = z.object({
  pet_id: z.string().min(1),
  title: z.string().min(1),
  event_date: z.string().datetime(),
  notes: z.string().nullable().optional(),
});

petEventsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const petId = String(req.query.petId ?? '');
    if (!petId) throw BadRequest('petId обязателен');
    await assertPetOwnership(petId, req.userId);

    const events = await prisma.petEvent.findMany({ where: { petId }, orderBy: { eventDate: 'asc' } });
    res.json({ events: events.map(serializePetEvent) });
  })
);

petEventsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    await assertPetOwnership(body.pet_id, req.userId);

    const event = await prisma.petEvent.create({
      data: {
        petId: body.pet_id,
        ownerId: req.userId,
        title: body.title,
        eventDate: new Date(body.event_date),
        notes: body.notes ?? null,
      },
    });

    res.status(201).json({ event: serializePetEvent(event) });
  })
);

petEventsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.petEvent.findUnique({ where: { id: req.params.id } });
    if (!existing) throw NotFound('Событие не найдено');
    if (existing.ownerId !== req.userId) throw Forbidden();

    await prisma.petEvent.delete({ where: { id: existing.id } });
    res.status(204).send();
  })
);
