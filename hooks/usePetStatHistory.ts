import { useEffect, useState } from 'react';

import { usePet } from '@/contexts/PetProvider';
import { api, isBackendConfigured } from '@/lib/api';
import type { PetStatSnapshot } from '@/types/database';

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// A gentle two-week trend so the diary chart has something meaningful to show offline.
function buildMockHistory(petId: string): PetStatSnapshot[] {
  const points = [
    { daysAgo: 13, hunger: 60, mood: 65, health: 88 },
    { daysAgo: 10, hunger: 68, mood: 70, health: 90 },
    { daysAgo: 7, hunger: 75, mood: 78, health: 90 },
    { daysAgo: 4, hunger: 70, mood: 80, health: 92 },
    { daysAgo: 1, hunger: 72, mood: 85, health: 93 },
  ];

  return points.map((point, index) => ({
    id: `mock-snapshot-${index}`,
    pet_id: petId,
    owner_id: 'local',
    hunger: point.hunger,
    mood: point.mood,
    health: point.health,
    recorded_at: hoursAgo(point.daysAgo * 24),
  }));
}

export function usePetStatHistory() {
  const { pet, loading: petLoading } = usePet();
  const petId = pet.id;
  const [snapshots, setSnapshots] = useState<PetStatSnapshot[]>([]);
  const [loading, setLoading] = useState(isBackendConfigured);

  useEffect(() => {
    if (!isBackendConfigured) {
      setSnapshots(buildMockHistory(petId));
      setLoading(false);
      return;
    }

    // PetProvider's own GET /pets/mine hasn't resolved yet — pet.id is still the
    // offline MOCK_PET placeholder, not a real id the server knows about. Fetching now
    // would 404 ("Питомец не найден") — see the matching comment in DiaryProvider.
    if (petLoading) return;

    let isMounted = true;

    (async () => {
      try {
        const { snapshots: fetched } = await api.getPetStatSnapshots(petId);
        if (isMounted) setSnapshots(fetched as PetStatSnapshot[]);
      } catch {
        // A transient failure isn't worth crashing over — same "fail quietly" pattern
        // as the other pet-scoped data providers.
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [petId, petLoading]);

  return { snapshots, loading };
}
