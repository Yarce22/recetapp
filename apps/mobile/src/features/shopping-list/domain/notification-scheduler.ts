import type { LowStockReminder } from './plan-low-stock-reminder';

/**
 * Port for reminders.
 *
 * Declared here so the feature can decide WHAT to remind someone about without
 * depending on how a notification is delivered - which differs per platform
 * and does not exist at all on web.
 */
export interface NotificationScheduler {
  /** Replaces any pending reminder. Passing null just cancels. */
  scheduleLowStockReminder(reminder: LowStockReminder | null): Promise<void>;
}
