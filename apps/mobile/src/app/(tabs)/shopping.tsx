import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { startOfWeek, type MealPlanEntryDto } from '@recetapp/contracts';

import { makeGetWeek } from '@/features/meal-plan/application/get-week';
import { createMealPlanRepository } from '@/features/meal-plan/infrastructure/create-meal-plan-repository';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import { buildShoppingList } from '@/features/shopping-list/domain/build-shopping-list';
import { planLowStockReminder } from '@/features/shopping-list/domain/plan-low-stock-reminder';
import { createNotificationScheduler } from '@/features/shopping-list/infrastructure/expo-notification-scheduler';
import { ShoppingListView } from '@/features/shopping-list/ui/shopping-list-view';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Spacing } from '@/shared/ui/theme';

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
    () => buildShoppingList({ pantry, planEntries, preferences }),
    [pantry, planEntries, preferences],
  );

  useEffect(() => {
    // Reminders follow the pantry, not this screen: every change replaces the
    // pending one so it can never name something already restocked.
    if (pantryLoading) return;

    void createNotificationScheduler().scheduleLowStockReminder(planLowStockReminder(pantry));
  }, [pantry, pantryLoading]);

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

  return (
    <ThemedView style={styles.screen}>
      <ScrollView>
        <View style={styles.header}>
          <ThemedText type="title">Shopping</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            What is running low, plus what this week&apos;s menu needs.
          </ThemedText>
        </View>

        {loading || pantryLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : (
          <ShoppingListView items={items} checked={checked} onToggle={toggle} />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: Spacing.three, gap: Spacing.one },
  centered: { padding: Spacing.six, alignItems: 'center' },
});
