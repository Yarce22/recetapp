import type { Translate } from '@/shared/i18n/translator';
import type { IconName } from '@/shared/ui/controls';
import type { Tone } from '@/shared/ui/theme';

import type { IngredientCategory } from '../domain/ingredient';

/** How each category looks: its pastel and icon. */
export const CATEGORY_STYLE: Record<IngredientCategory, { tone: Tone; icon: IconName }> = {
  produce: { tone: 'mint', icon: 'leaf' },
  dairy: { tone: 'butter', icon: 'egg' },
  meat: { tone: 'peach', icon: 'restaurant' },
  grain: { tone: 'lavender', icon: 'nutrition' },
  spice: { tone: 'warning', icon: 'flame' },
  other: { tone: 'sky', icon: 'cube' },
};

/**
 * The category's name in the active language.
 *
 * The category itself is a language-independent identifier ("dairy") that is
 * stored and sent to the server; only this label changes.
 */
export function categoryLabel(t: Translate, category: IngredientCategory): string {
  return t(`category.${category}`);
}
