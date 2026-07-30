import { useEffect, useRef, useState } from 'react';

import { api, isBackendConfigured } from '@/lib/api';
import type { UserStats } from '@/types/database';

const MOCK_STATS: UserStats = {
  owner_id: 'local',
  total_opens: 1,
  current_streak: 1,
  longest_streak: 1,
  last_active_date: new Date().toISOString().slice(0, 10),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Bumps total_opens/streak exactly once per app session and reads back the result —
// this is what backs the "usage level" (see lib/petLevel.ts), so opening the app more
// often and on consecutive days raises the level, not just logging diary entries.
export function useUserStats() {
  const [stats, setStats] = useState<UserStats>(MOCK_STATS);
  const [loading, setLoading] = useState(isBackendConfigured);
  const recordedRef = useRef(false);

  useEffect(() => {
    if (!isBackendConfigured || recordedRef.current) {
      setLoading(false);
      return;
    }
    recordedRef.current = true;

    let isMounted = true;

    (async () => {
      try {
        const { stats: recorded } = await api.recordAppOpen();
        if (isMounted) setStats(recorded as UserStats);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return { stats, loading };
}
