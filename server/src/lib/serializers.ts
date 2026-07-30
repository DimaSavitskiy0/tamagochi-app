import type { DiaryEntry, Pet, PetEvent, PetStatSnapshot, Reminder, Subscription, UserStats } from '@prisma/client';

// The client's types/database.ts (Pet, DiaryEntry, etc.) kept their original snake_case
// shape from the Postgres/Supabase days on purpose — serializing to that exact shape
// here means every hook body stays close to untouched, just swapping the data source.

export function serializePet(pet: Pet) {
  return {
    id: pet.id,
    owner_id: pet.ownerId,
    name: pet.name,
    breed: pet.breed,
    age_years: pet.ageYears === null ? null : Number(pet.ageYears),
    species: pet.species,
    hunger: pet.hunger,
    mood: pet.mood,
    health: pet.health,
    created_at: pet.createdAt.toISOString(),
    updated_at: pet.updatedAt.toISOString(),
  };
}

export function serializeDiaryEntry(entry: DiaryEntry) {
  return {
    id: entry.id,
    pet_id: entry.petId,
    owner_id: entry.ownerId,
    entry_type: entry.entryType,
    content: entry.content,
    mood_tag: entry.moodTag,
    metadata: entry.metadata,
    created_at: entry.createdAt.toISOString(),
  };
}

export function serializeReminder(reminder: Reminder) {
  return {
    id: reminder.id,
    pet_id: reminder.petId,
    owner_id: reminder.ownerId,
    type: reminder.type,
    due_date: reminder.dueDate.toISOString(),
    completed_at: reminder.completedAt ? reminder.completedAt.toISOString() : null,
    source: reminder.source,
    created_at: reminder.createdAt.toISOString(),
  };
}

export function serializePetStatSnapshot(snapshot: PetStatSnapshot) {
  return {
    id: snapshot.id,
    pet_id: snapshot.petId,
    owner_id: snapshot.ownerId,
    hunger: snapshot.hunger,
    mood: snapshot.mood,
    health: snapshot.health,
    recorded_at: snapshot.recordedAt.toISOString(),
  };
}

export function serializePetEvent(event: PetEvent) {
  return {
    id: event.id,
    pet_id: event.petId,
    owner_id: event.ownerId,
    title: event.title,
    event_date: event.eventDate.toISOString(),
    notes: event.notes,
    created_at: event.createdAt.toISOString(),
  };
}

export function serializeSubscription(sub: Subscription) {
  return {
    id: sub.id,
    owner_id: sub.ownerId,
    plan: sub.plan,
    status: sub.status,
    current_period_end: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    trial_ends_at: sub.trialEndsAt.toISOString(),
    yookassa_payment_id: sub.yookassaPaymentId,
    created_at: sub.createdAt.toISOString(),
    updated_at: sub.updatedAt.toISOString(),
  };
}

export function serializeUserStats(stats: UserStats) {
  return {
    owner_id: stats.ownerId,
    total_opens: stats.totalOpens,
    current_streak: stats.currentStreak,
    longest_streak: stats.longestStreak,
    last_active_date: stats.lastActiveDate ? stats.lastActiveDate.toISOString().slice(0, 10) : null,
    created_at: stats.createdAt.toISOString(),
    updated_at: stats.updatedAt.toISOString(),
  };
}
