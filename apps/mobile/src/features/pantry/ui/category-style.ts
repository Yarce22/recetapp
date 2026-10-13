import type { IconName } from '@/shared/ui/controls';
import type { Tone } from '@/shared/ui/theme';

import type { IngredientCategory } from '../domain/ingredient';

/** How each category looks: its label, pastel and icon. */
export const CATEGORY_STYLE: Record<
  IngredientCategory,
  { label: string; tone: Tone; icon: IconName }
> = {
  produce: { label: 'Produce', tone: 'mint', icon: 'leaf' },
  dairy: { label: 'Dairy', tone: 'butter', icon: 'egg' },
  meat: { label: 'Meat', tone: 'peach', icon: 'restaurant' },
  grain: { label: 'Grains', tone: 'lavender', icon: 'nutrition' },
  spice: { label: 'Spices', tone: 'warning', icon: 'flame' },
  other: { label: 'Other', tone: 'sky', icon: 'cube' },
};
