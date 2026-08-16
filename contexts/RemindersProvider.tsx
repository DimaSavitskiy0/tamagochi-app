import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { useDiary } from '@/contexts/DiaryProvider';
import { usePet } from '@/contexts/PetProvider';
import { api, isBackendConfigured } from '@/lib/api';
import type { DiaryEntry, Reminder, ReminderType } from '@/types/database';

// A Context, not a plain hook, for the same reason as DiaryProvider/PetProvider — both
// pet.tsx and calendar.tsx read reminders, and calendar.tsx's own separate instance
// would never see a reminder auto-created/completed from the pet screen (or vice versa).

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

type RemindersContextValue = {
  reminders: Reminder[];
  upcoming: Reminder[];
  loading: boolean;
  markCompleted: (reminderId: string) => Promise<void>;
  createManualReminder: (type: ReminderType, dueDate: Date) => Promise<Reminder>;
  refetch: () => Promise<void>;
};

const RemindersContext = createContext<RemindersContextValue | undefined>(undefined);

export function RemindersProvider({ children }: { children: ReactNode }) {
  const { pet, loading: petLoading } = usePet();
  const petId = pet.id;
  const { entries: diaryEntries } = useDiary();
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
    } catch {
      // A transient failure isn't worth crashing over — the reminders list just stays
      // whatever it was (empty on first load), same "fail quietly" pattern as the
      // other providers.
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    // See the matching comment in DiaryProvider — pet.id is still the offline
    // placeholder until PetProvider's own fetch resolves.
    if (isBackendConfigured && petLoading) return;
    load();
  }, [load, petLoading]);

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
            try {
              const { reminder } = await api.addReminder({
                pet_id: petId,
                type: item.type,
                due_date: item.due_date,
                source: 'auto',
              });
              setReminders((prev) => [...prev, reminder as Reminder]);
            } catch (err) {
              // This effect runs automatically (no user action, no button to catch a
              // rejection for) whenever diary entries change — without a catch here, a
              // network failure would surface as an unhandled rejection out of nowhere.
              console.warn('[RemindersProvider] auto-create reminder failed, will retry next sync:', err);
            }
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
            try {
              await api.patchReminder(openReminder.id, { due_date: item.due_date });
            } catch (err) {
              console.warn('[RemindersProvider] auto-nudge reminder failed, will retry next sync:', err);
            }
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

      try {
        const { reminder } = await api.addReminder({ pet_id: petId, type, due_date, source: 'manual' });
        setReminders((prev) => [...prev, reminder as Reminder]);
        return reminder as Reminder;
      } catch (err) {
        // No connectivity — same local-fallback shape as the isBackendConfigured
        // branch above, instead of throwing into AddReminderModal's try/finally
        // (which has no catch) and crashing with an unhandled rejection.
        console.warn('[RemindersProvider] createManualReminder failed, saved locally only:', err);
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
    },
    [petId]
  );

  const markCompleted = useCallback(async (reminderId: string) => {
    const completedAt = new Date().toISOString();
    setReminders((current) =>
      current.map((r) => (r.id === reminderId ? { ...r, completed_at: completedAt } : r))
    );

    if (isBackendConfigured) {
      try {
        await api.patchReminder(reminderId, { completed_at: completedAt });
      } catch (err) {
        // Local state is already updated optimistically above — just log it. The
        // server falling out of sync until the next successful write beats throwing
        // an unhandled rejection from a checkbox tap.
        console.warn('[RemindersProvider] markCompleted failed to sync:', err);
      }
    }
  }, []);

  const upcoming = reminders
    .filter((r) => !r.completed_at)
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1));

  return (
    <RemindersContext.Provider
      value={{ reminders, upcoming, loading, markCompleted, createManualReminder, refetch: load }}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders(): RemindersContextValue {
  const ctx = useContext(RemindersContext);
  if (!ctx) throw new Error('useReminders must be used within RemindersProvider');
  return ctx;
}
