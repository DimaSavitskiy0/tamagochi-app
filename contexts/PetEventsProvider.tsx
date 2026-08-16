import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { usePet } from '@/contexts/PetProvider';
import { api, isBackendConfigured } from '@/lib/api';
import type { PetEvent } from '@/types/database';

// A Context, not a plain hook, for the same reason as DiaryProvider — pet.tsx and
// calendar.tsx both read events; a plain hook would give calendar.tsx its own copy that
// never saw an event added anywhere else.

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function buildMockEvents(petId: string): PetEvent[] {
  return [
    {
      id: 'mock-event-1',
      pet_id: petId,
      owner_id: 'local',
      title: 'Стрижка когтей',
      event_date: daysFromNow(3),
      notes: null,
      created_at: new Date().toISOString(),
    },
    {
      id: 'mock-event-2',
      pet_id: petId,
      owner_id: 'local',
      title: 'Визит к грумеру',
      event_date: daysFromNow(12),
      notes: 'Записаться заранее, в выходные очередь',
      created_at: new Date().toISOString(),
    },
  ];
}

type PetEventsContextValue = {
  events: PetEvent[];
  loading: boolean;
  addEvent: (input: { title: string; eventDate: Date; notes?: string }) => Promise<PetEvent>;
  deleteEvent: (eventId: string) => Promise<void>;
  refetch: () => Promise<void>;
};

const PetEventsContext = createContext<PetEventsContextValue | undefined>(undefined);

export function PetEventsProvider({ children }: { children: ReactNode }) {
  const { pet, loading: petLoading } = usePet();
  const petId = pet.id;
  const [events, setEvents] = useState<PetEvent[]>([]);
  const [loading, setLoading] = useState(isBackendConfigured);

  const load = useCallback(async () => {
    if (!isBackendConfigured) {
      setEvents(buildMockEvents(petId));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { events: fetched } = await api.getPetEvents(petId);
      setEvents((fetched as PetEvent[]).slice().sort((a, b) => (a.event_date < b.event_date ? -1 : 1)));
    } catch {
      // A transient failure isn't worth crashing over — same "fail quietly" pattern as
      // the other providers.
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

  const addEvent = useCallback(
    async (input: { title: string; eventDate: Date; notes?: string }) => {
      const event_date = input.eventDate.toISOString();

      if (!isBackendConfigured) {
        const created: PetEvent = {
          id: `local-event-${Date.now()}`,
          pet_id: petId,
          owner_id: 'local',
          title: input.title,
          event_date,
          notes: input.notes ?? null,
          created_at: new Date().toISOString(),
        };
        setEvents((prev) => [...prev, created].sort((a, b) => (a.event_date < b.event_date ? -1 : 1)));
        return created;
      }

      try {
        const { event } = await api.addPetEvent({ pet_id: petId, title: input.title, event_date, notes: input.notes ?? null });
        setEvents((prev) => [...prev, event as PetEvent].sort((a, b) => (a.event_date < b.event_date ? -1 : 1)));
        return event as PetEvent;
      } catch (err) {
        // No connectivity — same local-fallback shape as the isBackendConfigured
        // branch above, instead of throwing into AddEventModal's try/finally (which
        // has no catch) and crashing with an unhandled rejection.
        console.warn('[PetEventsProvider] addEvent failed, saved locally only:', err);
        const created: PetEvent = {
          id: `local-event-${Date.now()}`,
          pet_id: petId,
          owner_id: 'local',
          title: input.title,
          event_date,
          notes: input.notes ?? null,
          created_at: new Date().toISOString(),
        };
        setEvents((prev) => [...prev, created].sort((a, b) => (a.event_date < b.event_date ? -1 : 1)));
        return created;
      }
    },
    [petId]
  );

  const deleteEvent = useCallback(async (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));

    if (isBackendConfigured) {
      try {
        await api.deletePetEvent(eventId);
      } catch (err) {
        // Local state already updated optimistically above — log and move on rather
        // than throwing an unhandled rejection from a delete tap.
        console.warn('[PetEventsProvider] deleteEvent failed to sync:', err);
      }
    }
  }, []);

  return (
    <PetEventsContext.Provider value={{ events, loading, addEvent, deleteEvent, refetch: load }}>
      {children}
    </PetEventsContext.Provider>
  );
}

export function usePetEvents(): PetEventsContextValue {
  const ctx = useContext(PetEventsContext);
  if (!ctx) throw new Error('usePetEvents must be used within PetEventsProvider');
  return ctx;
}
