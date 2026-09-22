import type { NotificationScheduler } from '../domain/notification-scheduler';

/**
 * Web does nothing.
 *
 * Scheduling a local notification hours ahead needs a service worker and a
 * permission prompt for a build that is a development convenience. The
 * shopping list still shows everything the reminder would have said.
 */
export function createNotificationScheduler(): NotificationScheduler {
  return {
    async scheduleLowStockReminder(): Promise<void> {},
  };
}
