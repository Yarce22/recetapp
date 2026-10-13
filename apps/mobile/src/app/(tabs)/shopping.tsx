import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Animated, ScrollView, StyleSheet, View } from 'react-native';

import { startOfWeek, type MealPlanEntryDto } from '@recetapp/contracts';

import { makeGetWeek } from '@/features/meal-plan/application/get-week';
import { createMealPlanRepository } from '@/features/meal-plan/infrastructure/create-meal-plan-repository';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import { buildShoppingList } from '@/features/shopping-list/domain/build-shopping-list';
import { planLowStockReminder } from '@/features/shopping-list/domain/plan-low-stock-reminder';
import { createNotificationScheduler } from '@/features/shopping-list/infrastructure/expo-notification-scheduler';
import { ShoppingListView } from '@/features/shopping-list/ui/shopping-list-view';
import { useTranslation } from '@/shared/i18n/i18n-provider';
import { withAllLocalizedStaples } from '@/shared/i18n/staples';
import { Screen, ScreenHeader } from '@/shared/ui/controls';
import { FadeIn, ProgressBar, Skeleton, useLoop } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

/**
 * Today as a calendar date, built from the local parts.
 *
 * `toISOString()` converts to UTC and can hand back yesterday.
 */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function ShoppingScreen() {
  const theme = useTheme();
  const translator = useTranslation();
  const { t } = translator;
  const { entries: pantry, loading: pantryLoading } = usePantry();
  const { preferences } = usePreferences();

  const weekStartDate = useMemo(() => startOfWeek(todayIsoDate()), []);
  const [planEntries, setPlanEntries] = useState<MealPlanEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  // Session-local: the list is derived from the pantry and the plan, so a
  // stored tick would outlive the item it was about.
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const repository = await createMealPlanRepository();
        const week = await makeGetWeek(repository)(weekStartDate);
        if (!cancelled) setPlanEntries(week);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [weekStartDate]);

  const items = useMemo(
    () =>
      buildShoppingList({
        pantry,
        planEntries,
        // A plan made in the other language names its staples differently.
        preferences: { ...preferences, staples: withAllLocalizedStaples(preferences.staples) },
      }),
    [pantry, planEntries, preferences],
  );

  useEffect(() => {
    // Reminders follow the pantry, not this screen: every change replaces the
    // pending one so it can never name something already restocked.
    if (pantryLoading) return;

    void createNotificationScheduler().scheduleLowStockReminder(
      planLowStockReminder(pantry, { t }),
    );
  }, [pantry, pantryLoading, t]);

  function toggle(name: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  const done = items.filter((item) => checked.has(item.name)).length;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ScreenHeader title={t('shopping.title')} />

        {loading || pantryLoading ? (
          <View style={styles.skeletons}>
            <Skeleton height={120} radius={Radius.xxl - 4} />
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} height={60} radius={Radius.lg} />
            ))}
          </View>
        ) : (
          <>
            {items.length > 0 ? (
              <FadeIn style={styles.summaryWrap}>
                <View style={[styles.summary, { backgroundColor: theme.sky }]}>
                  <View style={styles.summaryText}>
                    <ThemedText type="small" style={{ color: theme.skyInk }}>
                      {t('shopping.summary')}
                    </ThemedText>
                    <ThemedText type="heading">
                      {t('shopping.progress', { done, total: items.length })}
                    </ThemedText>
                    <ProgressBar
                      value={items.length === 0 ? 0 : done / items.length}
                      color={theme.blue}
                      trackColor={theme.backgroundElement}
                      height={10}
                      accessibilityLabel={t('shopping.progressLabel')}
                    />
                  </View>
                  <RollingCart />
                </View>
              </FadeIn>
            ) : null}
            <ShoppingListView items={items} checked={checked} onToggle={toggle} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

/** Cart that rolls back and forth beside the progress. Decorative. */
function RollingCart() {
  const theme = useTheme();
  const roll = useLoop(1400, { yoyo: true });

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.cart,
        { backgroundColor: theme.backgroundElement },
        {
          transform: [
            { translateX: roll.interpolate({ inputRange: [0, 1], outputRange: [-4, 6] }) },
            { rotate: roll.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) },
          ],
        },
      ]}
    >
      <Ionicons name="cart" size={34} color={theme.skyInk} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.five },
  skeletons: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  summaryWrap: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 20,
    borderRadius: Radius.xxl - 4,
  },
  summaryText: { flex: 1, gap: Spacing.two },
  cart: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
