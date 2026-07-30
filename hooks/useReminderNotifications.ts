import { useEffect } from 'react';

import { requestNotificationPermissions, syncReminderNotifications } from '@/lib/notifications';
import type { Reminder } from '@/types/database';

export function useReminderNotifications(reminders: Reminder[], petName: string) {
  useEffect(() => {
    (async () => {
      const granted = await requestNotificationPermissions();
      if (!granted) return;
      await syncReminderNotifications(reminders, petName);
    })();
  }, [reminders, petName]);
}
