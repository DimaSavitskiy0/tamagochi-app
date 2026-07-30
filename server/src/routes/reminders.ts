import { Router } from 'express';
import { z } from 'zod';

import { BadRequest, Forbidden, NotFound } from '../lib/errors';
import { assertPetOwnership } from '../lib/ownership';
import { prisma } from '../lib/prisma';
import { serializeReminder } from '../lib/serializers';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

export const remindersRouter = Router();
remindersRouter.use(requireAuth);

const reminderTypeSchema = z.enum(['vaccination', 'deworming', 'vet_visit', 'medicine']);

const createSchema = z.object({
  pet_id: z.string().min(1),
  type: reminderTypeSchema,
  due_date: z.string().datetime(),
  source: z.enum(['auto', 'manual']).default('auto'),
});

const patchSchema = z.object({
  due_date: z.string().datetime().optional(),
  completed_at: z.string().datetime().nullable().optional(),
});

remindersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const petId = String(req.query.petId ?? '');
    if (!petId) throw BadRequest('petId обязателен');
    await assertPetOwnership(petId, req.userId);

    const reminders = await prisma.reminder.findMany({ where: { petId }, orderBy: { dueDate: 'asc' } });
    res.json({ reminders: reminders.map(serializeReminder) });
  })
);

remindersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = createSchema.parse(req.body);
    await assertPetOwnership(body.pet_id, req.userId);

    const reminder = await prisma.reminder.create({
      data: {
        petId: body.pet_id,
        ownerId: req.userId,
        type: body.type,
        dueDate: new Date(body.due_date),
        source: body.source,
      },
    });

    res.status(201).json({ reminder: serializeReminder(reminder) });
  })
);

remindersRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await prisma.reminder.findUnique({ where: { id: req.params.id } });
    if (!existing) throw NotFound('Напоминание не найдено');
    if (existing.ownerId !== req.userId) throw Forbidden();

    const patch = patchSchema.parse(req.body);

    const reminder = await prisma.reminder.update({
      where: { id: existing.id },
      data: {
        ...(patch.due_date !== undefined && { dueDate: new Date(patch.due_date) }),
        ...(patch.completed_at !== undefined && {
          completedAt: patch.completed_at === null ? null : new Date(patch.completed_at),
        }),
      },
    });

    res.json({ reminder: serializeReminder(reminder) });
  })
);
