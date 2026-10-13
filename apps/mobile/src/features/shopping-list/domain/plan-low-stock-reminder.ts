import { isLowStock } from '@/features/pantry/domain/pantry-item';
import type { PantryEntry } from '@/features/pantry/domain/pantry-repository';
import { createTranslator, type Translate } from '@/shared/i18n/translator';

export type LowStockReminder = {
  title: string;
  body: string;
};

/** Beyond this, naming every ingredient stops being readable on a lock screen. */
const MAX_NAMED = 3;

function joinNames(names: string[], remaining: number, t: Translate): string {
  if (remaining > 0) return t('reminder.andMore', { names: names.join(', '), count: remaining });
  if (names.length === 1) return names[0];
  return t('reminder.and', {
    head: names.slice(0, -1).join(', '),
    last: names[names.length - 1],
  });
}

/**
 * Decides what a low-stock reminder should say, or that there is nothing to say.
 *
 * Pure on purpose: the interesting part is the wording and the "is there
 * anything worth interrupting someone for" decision, and neither needs a
 * notification API to be tested.
 *
 * Names ingredients rather than counting them. "3 items are running low" sends
 * the user to the app to find out which; naming them can be acted on from the
 * lock screen.
 *
 * The wording is in the language of `translator`, which defaults to English.
 */
export function planLowStockReminder(
  pantry: PantryEntry[],
  { t }: { t: Translate } = createTranslator('en'),
): LowStockReminder | null {
  const low = pantry.filter((entry) => isLowStock(entry.item));
  if (low.length === 0) return null;

  const names = low.slice(0, MAX_NAMED).map((entry) => entry.ingredient.displayName);
  const remaining = low.length - names.length;
  const subject = joinNames(names, remaining, t);

  return {
    title: t('reminder.title'),
    body: t('reminder.body', { subject, count: low.length }),
  };
}
