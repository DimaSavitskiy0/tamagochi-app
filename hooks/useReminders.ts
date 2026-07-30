import { useCallback, useEffect, useRef, useState } from 'react';

import { api, isBackendConfigured } from '@/lib/api';
import type { DiaryEntry, Reminder, ReminderType } from '@/types/database';

const VACCINATION_INTERVAL_DAYS = 365;
const DEWORMING_INTERVAL_DAYS = 90;
const VET_VISIT_INTERVAL_DAYS = 182;

function addDays(iso: string, days: number): string {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function isVaccinationEntry(entry: DiaryEntry): boolean {
  return entry.entry_type === 'vet' && entry.mood_tag === 'вакцинация';
}

function isDewormingEntry(entry: DiaryEntry): boolean {
  return entry.entry_type === 'medicine' && /дегельминт/i.test(entry.metadata.name);
}

function isVetVisitEntry(entry: DiaryEntry): boolean {
  return entry.entry_type === 'vet';
}

function latestDate(entries: DiaryEntry[], predicate: (entry: DiaryEntry) => boolean): string | null {
  const matches = entries.filter(predicate);
  if (matches.length === 0) return null;
  return matches.reduce(
    (latest, entry) => (entry.created_at > latest ? entry.created_at : latest),
    matches[0].created_at
  );
}

type ExpectedReminder = { type: ReminderType; due_date: string };

/**
 * Derives the single next-due reminder per type from diary history. Each rule needs
 * an anchor entry to count forward from — a pet with no relevant diary entries yet
 * simply has no reminder of that type until the owner logs one.
 */
function deriveExpectedReminders(entries: DiaryEntry[]): ExpectedReminder[] {
  const expected: ExpectedReminder[] = [];

  const lastVaccination = latestDate(entries, isVaccinationEntry);
  if (lastVaccination) {
    expected.push({ type: 'vaccination', due_date: addDays(lastVaccination, VACCINATION_INTERVAL_DAYS) });
  }

  const lastDeworming = latestDate(entries, isDewormingEntry);
  if (lastDeworming) {
    expected.push({ type: 'deworming', due_date: addDays(lastDeworming, DEWORMING_INTERVAL_DAYS) });
  }

  const lastVetVisit = latestDate(entries, isVetVisitEntry);
  if (lastVetVisit) {
    expected.push({ type: 'vet_visit', due_date: addDays(lastVetVisit, VET_VISIT_INTERVAL_DAYS) });
  }

  return expected;
}

export function useReminders(petId: string, diaryEntries: DiaryEntry[]) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(isBackendConfigured);
  const remindersRef = useRef<Reminder[]>([]);
  remindersRef.current = reminders;

  const load = useCallback(async () => {
    if (!isBackendConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { reminders: fetched } = await api.getReminders(petId);
      setReminders((fetched as Reminder[]).slice().sort((a, b) => (a.due_date < b.due_date ? -1 : 1)));
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    load();
  }, [load]);

  // Reconcile derived due dates against stored reminders: create the ones that don't
  // exist yet, and nudge an existing incomplete reminder's due_date forward if new
  // diary entries pushed it out (e.g. a fresh vet visit resets the 6-month clock).
  useEffect(() => {
    if (diaryEntries.length === 0) return;

    const expected = deriveExpectedReminders(diaryEntries);
    if (expected.length === 0) return;

    (async () => {
      for (const item of expected) {
        const openReminder = remindersRef.current.find((r) => r.type === item.type && !r.completed_at);

        if (!openReminder) {
          if (isBackendConfigured) {
            const { reminder } = await api.addReminder({
              pet_id: petId,
              type: item.type,
              due_date: item.due_date,
              source: 'auto',
            });
            setReminders((prev) => [...prev, reminder as Reminder]);
          } else {
            const created: Reminder = {
              id: `local-reminder-${item.type}-${Date.now()}`,
              pet_id: petId,
              owner_id: 'local',
              type: item.type,
              due_date: item.due_date,
              completed_at: null,
              source: 'auto',
              created_at: new Date().toISOString(),
            };
            setReminders((prev) => [...prev, created]);
          }
          continue;
        }

        // Manually scheduled reminders are never nudged by diary-derived dates.
        if (openReminder.source === 'manual') continue;

        if (openReminder.due_date !== item.due_date) {
          if (isBackendConfigured) {
            await api.patchReminder(openReminder.id, { due_date: item.due_date });
          }
          setReminders((prev) =>
            prev.map((r) => (r.id === openReminder.id ? { ...r, due_date: item.due_date } : r))
          );
        }
      }
    })();
  }, [diaryEntries, petId]);

  const createManualReminder = useCallback(
    async (type: ReminderType, dueDate: Date) => {
      const due_date = dueDate.toISOString();

      if (!isBackendConfigured) {
        const created: Reminder = {
          id: `local-reminder-${type}-${Date.now()}`,
          pet_id: petId,
          owner_id: 'local',
          type,
          due_date,
          completed_at: null,
          source: 'manual',
          created_at: new Date().toISOString(),
        };
        setReminders((prev) => [...prev, created]);
        return created;
      }

      const { reminder } = await api.addReminder({ pet_id: petId, type, due_date, source: 'manual' });
      setReminders((prev) => [...prev, reminder as Reminder]);
      return reminder as Reminder;
    },
    [petId]
  );

  const markCompleted = useCallback(async (reminderId: string) => {
    const completedAt = new Date().toISOString();
    setReminders((current) =>
      current.map((r) => (r.id === reminderId ? { ...r, completed_at: completedAt } : r))
    );

    if (isBackendConfigured) {
      await api.patchReminder(reminderId, { completed_at: completedAt });
    }
  }, []);

  const upcoming = reminders
    .filter((r) => !r.completed_at)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  return { reminders, upcoming, loading, markCompleted, createManualReminder, refetch: load };
}
