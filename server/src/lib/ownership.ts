import { prisma } from './prisma';
import { NotFound } from './errors';

// Replaces the `exists (select 1 from public.pets p where p.id = X.pet_id and
// p.owner_id = auth.uid())` clause every RLS policy in the old schema.sql carried for
// diary_entries/reminders/pet_stat_snapshots/pet_events — a user can only ever act on
// rows attached to a pet they own, never someone else's pet_id.
export async function assertPetOwnership(petId: string, ownerId: string): Promise<void> {
  const pet = await prisma.pet.findFirst({ where: { id: petId, ownerId }, select: { id: true } });
  if (!pet) throw NotFound('Питомец не найден');
}
