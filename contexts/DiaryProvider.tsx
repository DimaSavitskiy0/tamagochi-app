import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { usePet } from '@/contexts/PetProvider';
import { api, isBackendConfigured } from '@/lib/api';
import type { DiaryEntry, NewDiaryEntry } from '@/types/database';

// A Context, not a plain hook, for the same reason as PetProvider (see its comment):
// pet.tsx, diary.tsx and calendar.tsx all need the diary — a plain hook would give each
// its own independent copy, so an entry added on the Питомец screen would silently not
// show up on the Дневник tab (or feed into calendar's useReminders) until that screen
// happened to remount.

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function buildMockEntries(petId: string): DiaryEntry[] {
  const entries: DiaryEntry[] = [
    {
      id: 'mock-1',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'feeding',
      content: 'Сухой корм — 150 г',
      mood_tag: null,
      metadata: { food: 'Сухой корм', amount: '150 г' },
      created_at: hoursAgo(2),
    },
    {
      id: 'mock-2',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'weight',
      content: 'Вес: 4.2 кг',
      mood_tag: null,
      metadata: { valueKg: 4.2 },
      created_at: hoursAgo(6),
    },
    {
      id: 'mock-3',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'walk',
      content: 'Прогулка 30 мин',
      mood_tag: null,
      metadata: { durationMinutes: 30 },
      created_at: hoursAgo(26),
    },
    {
      id: 'mock-4',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'medicine',
      content: 'Витамины — 1 таблетка',
      mood_tag: null,
      metadata: { name: 'Витамины', dosage: '1 таблетка' },
      created_at: hoursAgo(30),
    },
    {
      id: 'mock-5',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'weight',
      content: 'Вес: 4.1 кг',
      mood_tag: null,
      metadata: { valueKg: 4.1 },
      created_at: hoursAgo(50),
    },
    {
      id: 'mock-6',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'vet',
      content: 'Плановый осмотр, всё в порядке',
      mood_tag: 'вакцинация',
      metadata: {},
      created_at: hoursAgo(54),
    },
    {
      id: 'mock-7',
      pet_id: petId,
      owner_id: 'local',
      entry_type: 'medicine',
      content: 'Дегельминтизация (Мильбемакс) — 1 таблетка',
      mood_tag: null,
      metadata: { name: 'Дегельминтизация (Мильбемакс)', dosage: '1 таблетка' },
      created_at: hoursAgo(85 * 24),
    },
  ];

  return entries.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

type DiaryContextValue = {
  entries: DiaryEntry[];
  loading: boolean;
  error: string | null;
  addEntry: (input: NewDiaryEntry) => Promise<DiaryEntry>;
  refetch: () => Promise<void>;
};

const DiaryContext = createContext<DiaryContextValue | undefined>(undefined);

export function DiaryProvider({ children }: { children: ReactNode }) {
  const { pet, loading: petLoading } = usePet();
  const petId = pet.id;
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    if (!isBackendConfigured) {
      setEntries(buildMockEntries(petId));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { entries: fetched } = await api.getDiaryEntries(petId);
      setEntries(fetched as DiaryEntry[]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить дневник');
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    // PetProvider's own async GET /pets/mine hasn't resolved yet — pet.id is still the
    // offline MOCK_PET placeholder ('local-pet'), not a real id the server knows about.
    // Fetching now would 404 ("Питомец не найден") and get silently overwritten a moment
    // later anyway once the real pet loads and this effect re-runs.
    if (isBackendConfigured && petLoading) return;
    fetchEntries();
  }, [fetchEntries, petLoading]);

  const addEntry = useCallback(
    async (input: NewDiaryEntry) => {
      if (!isBackendConfigured) {
        const optimistic: DiaryEntry = {
          id: `mock-${Date.now()}`,
          pet_id: petId,
          owner_id: 'local',
          mood_tag: null,
          created_at: new Date().toISOString(),
          ...input,
        } as DiaryEntry;
        setEntries((prev) => [optimistic, ...prev]);
        return optimistic;
      }

      const { entry } = await api.addDiaryEntry({ pet_id: petId, ...input });
      setEntries((prev) => [entry as DiaryEntry, ...prev]);
      return entry as DiaryEntry;
    },
    [petId]
  );

  return (
    <DiaryContext.Provider value={{ entries, loading, error, addEntry, refetch: fetchEntries }}>
      {children}
    </DiaryContext.Provider>
  );
}

export function useDiary(): DiaryContextValue {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used within DiaryProvider');
  return ctx;
}
