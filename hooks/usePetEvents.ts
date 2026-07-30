import { useCallback, useEffect, useState } from 'react';

import { api, isBackendConfigured } from '@/lib/api';
import type { PetEvent } from '@/types/database';

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

export function usePetEvents(petId: string) {
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
    } finally {
      setLoading(false);
    }
  }, [petId]);

  useEffect(() => {
    load();
  }, [load]);

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

      const { event } = await api.addPetEvent({ pet_id: petId, title: input.title, event_date, notes: input.notes ?? null });
      setEvents((prev) => [...prev, event as PetEvent].sort((a, b) => (a.event_date < b.event_date ? -1 : 1)));
      return event as PetEvent;
    },
    [petId]
  );

  const deleteEvent = useCallback(async (eventId: string) => {
    setEvents((prev) => prev.filter((event) => event.id !== eventId));

    if (isBackendConfigured) {
      await api.deletePetEvent(eventId);
    }
  }, []);

  return { events, loading, addEvent, deleteEvent, refetch: load };
}
