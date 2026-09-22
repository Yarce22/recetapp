import * as Notifications from 'expo-notifications';

import type { NotificationScheduler } from '../domain/notification-scheduler';
import type { LowStockReminder } from '../domain/plan-low-stock-reminder';

/** Far enough away that it reads as a reminder rather than a reaction. */
const REMIND_IN_SECONDS = 60 * 60 * 8;

/**
 * Local notifications through expo-notifications.
 *
 * Local only: nothing is sent from a server, so no push credentials and no
 * device token ever leaves the phone.
 *
 * Every call cancels what was pending first. The reminder describes the
 * current state of the pantry, and a stale one naming an ingredient the user
 * already restocked is worse than none.
 */
export function createNotificationScheduler(): NotificationScheduler {
  return {
    async scheduleLowStockReminder(reminder: LowStockReminder | null): Promise<void> {
      try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        if (!reminder) return;

        const settings = await Notifications.getPermissionsAsync();
        const granted = settings.granted || (await Notifications.requestPermissionsAsync()).granted;

        // Declining is an answer. Nagging on every pantry edit is not.
        if (!granted) return;

        await Notifications.scheduleNotificationAsync({
          content: { title: reminder.title, body: reminder.body },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: REMIND_IN_SECONDS,
          },
        });
      } catch {
        // A reminder that cannot be scheduled is not worth breaking the pantry
        // screen over. The list itself still shows everything.
      }
    },
  };
}
