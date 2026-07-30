import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Reminder, ReminderType } from '@/types/database';

const REMINDER_TITLES: Record<ReminderType, string> = {
  vaccination: 'Пора на вакцинацию',
  deworming: 'Пора на дегельминтизацию',
  vet_visit: 'Пора на плановый визит к ветеринару',
  medicine: 'Пора дать лекарство',
};

const REMINDER_NOTIFICATION_PREFIX = 'reminder-';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** expo-notifications' scheduled local triggers aren't supported on web. */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

function notificationIdFor(reminder: Reminder): string {
  return `${REMINDER_NOTIFICATION_PREFIX}${reminder.id}`;
}

/**
 * Schedules a local notification for each incomplete, future reminder and cancels
 * ones that are no longer upcoming (completed or their due date passed). Re-running
 * with the same reminder id + due_date is a cheap no-op since scheduleNotificationAsync
 * overwrites the existing scheduled notification for that identifier.
 */
export async function syncReminderNotifications(reminders: Reminder[], petName: string) {
  if (Platform.OS === 'web') return;

  const upcoming = reminders.filter(
    (reminder) => !reminder.completed_at && new Date(reminder.due_date).getTime() > Date.now()
  );
  const upcomingIds = new Set(upcoming.map(notificationIdFor));

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notification of scheduled) {
    if (notification.identifier.startsWith(REMINDER_NOTIFICATION_PREFIX) && !upcomingIds.has(notification.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  for (const reminder of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: notificationIdFor(reminder),
      content: {
        title: REMINDER_TITLES[reminder.type],
        body: `${petName}: не забудьте про это сегодня`,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(reminder.due_date),
      },
    });
  }
}
