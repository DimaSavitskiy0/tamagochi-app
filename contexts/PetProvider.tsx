import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, isBackendConfigured } from '@/lib/api';
import type { Pet } from '@/types/database';

const MOCK_PET: Pet = {
  id: 'local-pet',
  owner_id: 'local',
  name: 'Питомец',
  breed: null,
  age_years: null,
  species: 'cat',
  hunger: 72,
  mood: 85,
  health: 93,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

type PetContextValue = {
  pet: Pet;
  loading: boolean;
  updatePet: (
    patch: Partial<Pick<Pet, 'name' | 'breed' | 'age_years' | 'species' | 'hunger' | 'mood' | 'health'>>
  ) => Promise<void>;
  adjustStat: (key: 'hunger' | 'mood' | 'health', delta: number) => void;
  isBackendConfigured: boolean;
};

const PetContext = createContext<PetContextValue | undefined>(undefined);

// A single pet entity is shared across every tab (pet screen, diary, calendar, profile),
// so its state lives here once instead of each screen's own usePet() call keeping an
// independent copy — which would silently diverge as soon as one screen edited it.
export function PetProvider({ children }: { children: ReactNode }) {
  const [pet, setPet] = useState<Pet>(MOCK_PET);
  const [loading, setLoading] = useState(isBackendConfigured);

  useEffect(() => {
    if (!isBackendConfigured) return;

    let isMounted = true;

    // The server's GET /pets/mine creates a default pet row on first call for a
    // brand-new account (mirrors the old select-or-insert effect this used to do
    // directly against Supabase), so there's nothing else to do here.
    (async () => {
      try {
        const { pet: fetched } = await api.getMyPet();
        if (isMounted) setPet(fetched as Pet);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const updatePet = useCallback(
    async (
      patch: Partial<Pick<Pet, 'name' | 'breed' | 'age_years' | 'species' | 'hunger' | 'mood' | 'health'>>
    ) => {
      if (!isBackendConfigured) {
        setPet((prev) => ({ ...prev, ...patch, updated_at: new Date().toISOString() }));
        return;
      }

      // Stat snapshotting for the diary trend chart happens server-side (see
      // server/src/routes/pets.ts) whenever hunger/mood/health change — nothing to do
      // here beyond sending the patch and applying the response.
      const { pet: updated } = await api.patchPet(pet.id, patch);
      setPet(updated as Pet);
    },
    [pet.id]
  );

  const adjustStat = useCallback(
    (key: 'hunger' | 'mood' | 'health', delta: number) => {
      const nextValue = Math.max(0, Math.min(100, pet[key] + delta));
      updatePet({ [key]: nextValue });
    },
    [pet, updatePet]
  );

  return (
    <PetContext.Provider value={{ pet, loading, updatePet, adjustStat, isBackendConfigured }}>
      {children}
    </PetContext.Provider>
  );
}

export function usePet() {
  const ctx = useContext(PetContext);
  if (!ctx) throw new Error('usePet must be used within PetProvider');
  return ctx;
}
