import { StyleSheet, View } from 'react-native';

import { REGIONS, type Region } from '@recetapp/contracts';

import type { TranslationKey } from '@/shared/i18n/catalog';
import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Chip, SegmentedControl } from '@/shared/ui/controls';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import {
  MEAL_SLOTS,
  MENU_PERIODS,
  toggleMealSlot,
  type MenuPeriod,
  type MenuSettings,
} from '../domain/menu-settings';

/** One label per region. A missing entry is a compile error, which keeps new regions honest. */
const REGION_LABELS: Record<Region, TranslationKey> = { CO: 'region.CO' };

const PERIOD_LABELS: Record<MenuPeriod, TranslationKey> = {
  weekly: 'menu.settings.period.weekly',
  biweekly: 'menu.settings.period.biweekly',
};

export type MenuSettingsPanelProps = {
  settings: MenuSettings;
  onChange: (next: MenuSettings) => void;
};

/** Compact editor for how the menu is generated. Controlled: it owns no state. */
export function MenuSettingsPanel({ settings, onChange }: MenuSettingsPanelProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const toggles = [
    {
      key: 'allowRepeats' as const,
      label: t('menu.settings.allowRepeats'),
      hint: t('menu.settings.allowRepeats.hint'),
    },
    {
      key: 'includeIngredients' as const,
      label: t('menu.settings.includeIngredients'),
      hint: t('menu.settings.includeIngredients.hint'),
    },
  ];

  return (
    <View
      accessibilityLabel={t('menu.settings.title')}
      style={[styles.panel, { backgroundColor: theme.backgroundElement }]}
    >
      <View style={styles.group}>
        <ThemedText type="smallBold">{t('menu.settings.period')}</ThemedText>
        <SegmentedControl
          tone="lavender"
          value={settings.period}
          options={MENU_PERIODS.map((value) => ({ value, label: t(PERIOD_LABELS[value]) }))}
          onChange={(period) => onChange({ ...settings, period })}
        />
      </View>

      <View style={styles.group}>
        <ThemedText type="smallBold">{t('menu.settings.meals')}</ThemedText>
        <View style={styles.row}>
          {MEAL_SLOTS.map((slot) => (
            <Chip
              key={slot}
              label={t(`meal.${slot}`)}
              tone="lavender"
              accessibilityRole="switch"
              stateKey="checked"
              accessibilityLabel={t('menu.planMeal', { meal: t(`meal.${slot}`) })}
              selected={settings.slots.includes(slot)}
              onPress={() => onChange({ ...settings, slots: toggleMealSlot(settings.slots, slot) })}
            />
          ))}
        </View>
      </View>

      {toggles.map(({ key, label, hint }) => (
        <View key={key} style={styles.group}>
          <Chip
            label={label}
            tone="lavender"
            accessibilityRole="switch"
            stateKey="checked"
            accessibilityLabel={label}
            selected={settings[key]}
            onPress={() => onChange({ ...settings, [key]: !settings[key] })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        </View>
      ))}

      <View style={styles.group}>
        <ThemedText type="smallBold">{t('menu.settings.region')}</ThemedText>
        <View style={styles.row}>
          {REGIONS.map((region) => (
            <Chip
              key={region}
              label={t(REGION_LABELS[region])}
              tone="lavender"
              accessibilityLabel={`${t('menu.settings.region')}: ${t(REGION_LABELS[region])}`}
              selected={settings.region === region}
              onPress={() => onChange({ ...settings, region })}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.three, borderRadius: Radius.xl, gap: Spacing.three },
  group: { gap: Spacing.two, alignItems: 'flex-start' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
