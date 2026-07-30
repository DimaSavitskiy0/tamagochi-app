import { useCallback, useEffect, useState } from 'react';

import { api, isBackendConfigured } from '@/lib/api';

// Offline demo mode has no server to call, so there's no fake "AI" text to show —
// the card just doesn't render (see components/pet/AiRecommendationCard.tsx). Same for
// a 503 from the server when ANTHROPIC_API_KEY isn't configured there yet.
export function useAiRecommendation(petId: string) {
  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(isBackendConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(
    async (refresh: boolean) => {
      if (!isBackendConfigured) {
        setLoading(false);
        return;
      }
      refresh ? setRefreshing(true) : setLoading(true);
      try {
        const { tip: fetched } = await api.getAiTip(petId, refresh);
        setTip(fetched);
        setUnavailable(false);
      } catch {
        // Most likely a 503 (no ANTHROPIC_API_KEY on the server yet) — fail quietly,
        // this is a nice-to-have card, not a core feature.
        setUnavailable(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [petId]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return { tip, loading, refreshing, unavailable, refresh: () => load(true) };
}
