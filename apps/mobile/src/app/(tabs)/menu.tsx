import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { startOfWeek, weekDates, type MealPlanEntryDto, type MealSlot } from '@recetapp/contracts';

import { makeClearSlot } from '@/features/meal-plan/application/clear-slot';
import { makeGenerateWeek } from '@/features/meal-plan/application/generate-week';
import { makeGetWeek } from '@/features/meal-plan/application/get-week';
import { makeRegenerateDay } from '@/features/meal-plan/application/regenerate-day';
import { createMealPlanRepository } from '@/features/meal-plan/infrastructure/create-meal-plan-repository';
import { WeeklyGrid } from '@/features/meal-plan/ui/weekly-grid';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import {
  RateLimitedError,
  SuggestionServiceError,
} from '@/features/recipes/domain/recipe-suggestion-service';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { API_BASE_URL } from '@/shared/config/api';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

const ALL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

/**
 * Today as a calendar date.
 *
 * Built from the local parts rather than `toISOString()`, which converts to
 * UTC and can hand back yesterday.
 */
function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function MenuScreen() {
  const theme = useTheme();
  const { entries: pantry } = usePantry();
  const { preferences, deviceId } = usePreferences();

  const weekStartDate = useMemo(() => startOfWeek(todayIsoDate()), []);

  // Dinner only by default. Asking one model call for 21 genuinely different
  // dishes produces repetition; the user can widen it when they want to.
  const [slots, setSlots] = useState<MealSlot[]>(['dinner']);
  const [entries, setEntries] = useState<MealPlanEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const service = useMemo(
    () =>
      deviceId ? createHttpRecipeSuggestionService({ baseUrl: API_BASE_URL, deviceId }) : null,
    [deviceId],
  );
  const repositoryPromise = useMemo(() => createMealPlanRepository(), []);

  const reload = useCallback(async () => {
    const repository = await repositoryPromise;
    setEntries(await makeGetWeek(repository)(weekStartDate));
  }, [repositoryPromise, weekStartDate]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const repository = await repositoryPromise;
        const week = await makeGetWeek(repository)(weekStartDate);
        if (!cancelled) setEntries(week);
      } catch {
        if (!cancelled) setError('Could not read your plan.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise, weekStartDate]);

  function describeFailure(cause: unknown): string {
    if (cause instanceof RateLimitedError) {
      const minutes = Math.ceil(cause.retryAfterSeconds / 60);
      return `You have asked a lot in the last hour. Try again in about ${minutes} min.`;
    }
    if (cause instanceof SuggestionServiceError) return cause.message;
    return 'Something went wrong planning your week.';
  }

  function describeUnfilled(count: number): string | null {
    if (count === 0) return null;
    // Saying so beats leaving gaps the user has to notice and explain.
    return `${count} ${count === 1 ? 'meal' : 'meals'} could not be filled without repeating a dish. Add more to your pantry, or allow a couple of extra ingredients.`;
  }

  const planWeek = useCallback(async () => {
    if (!service) return;

    setPlanning(true);
    setError(null);
    setNotice(null);
    try {
      const repository = await repositoryPromise;
      const result = await makeGenerateWeek(
        repository,
        service,
      )({
        weekStartDate,
        slots: weekDates(weekStartDate).flatMap((date) => slots.map((slot) => ({ date, slot }))),
        pantry,
        preferences,
      });
      await reload();
      setNotice(describeUnfilled(result.unfilled.length));
    } catch (cause) {
      setError(describeFailure(cause));
    } finally {
      setPlanning(false);
    }
  }, [service, repositoryPromise, weekStartDate, slots, pantry, preferences, reload]);

  const regenerateDay = useCallback(
    async (date: string) => {
      if (!service) return;

      setBusyDate(date);
      setError(null);
      setNotice(null);
      try {
        const repository = await repositoryPromise;
        const result = await makeRegenerateDay(
          repository,
          service,
        )({
          weekStartDate,
          date,
          slots,
          pantry,
          preferences,
        });
        await reload();
        setNotice(describeUnfilled(result.unfilled.length));
      } catch (cause) {
        setError(describeFailure(cause));
      } finally {
        setBusyDate(null);
      }
    },
    [service, repositoryPromise, weekStartDate, slots, pantry, preferences, reload],
  );

  const clearSlot = useCallback(
    async (date: string, slot: MealSlot) => {
      const repository = await repositoryPromise;
      await makeClearSlot(repository)({ date, slot });
      await reload();
    },
    [repositoryPromise, reload],
  );

  function toggleSlot(slot: MealSlot) {
    setSlots((current) =>
      current.includes(slot)
        ? // Never leave the week with no meals to plan.
          current.length === 1
          ? current
          : current.filter((entry) => entry !== slot)
        : ALL_SLOTS.filter((entry) => current.includes(entry) || entry === slot),
    );
  }

  return (
    <ThemedView style={styles.screen}>
      <ScrollView>
        <View style={styles.header}>
          <ThemedText type="title">Weekly menu</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Week of {weekStartDate}
          </ThemedText>
        </View>

        <View style={styles.controls}>
          <View style={styles.slotPicker}>
            {ALL_SLOTS.map((slot) => {
              const on = slots.includes(slot);
              return (
                <Pressable
                  key={slot}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Plan ${slot}`}
                  onPress={() => toggleSlot(slot)}
                  style={[
                    styles.slotChip,
                    {
                      backgroundColor: on ? theme.backgroundSelected : theme.backgroundElement,
                      opacity: on ? 1 : 0.5,
                    },
                  ]}
                >
                  <ThemedText type="small">{slot}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={planning || pantry.length === 0}
            onPress={planWeek}
            style={[
              styles.plan,
              {
                backgroundColor: theme.backgroundSelected,
                opacity: planning || pantry.length === 0 ? 0.5 : 1,
              },
            ]}
          >
            <ThemedText type="smallBold">{planning ? 'Planning...' : 'Plan my week'}</ThemedText>
          </Pressable>

          {pantry.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Add something to your pantry first.
            </ThemedText>
          ) : null}
          {error ? <ThemedText type="small">{error}</ThemedText> : null}
          {notice ? (
            <ThemedText type="small" themeColor="textSecondary">
              {notice}
            </ThemedText>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        ) : (
          <WeeklyGrid
            weekStartDate={weekStartDate}
            slots={slots}
            entries={entries}
            busyDate={busyDate}
            onSelect={(entry) =>
              router.push({
                pathname: '/recipe/[id]',
                params: { id: entry.dishId, title: entry.dishTitle },
              })
            }
            onClear={clearSlot}
            onRegenerateDay={regenerateDay}
          />
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { padding: Spacing.three, gap: Spacing.one },
  controls: { paddingHorizontal: Spacing.three, gap: Spacing.three },
  slotPicker: { flexDirection: 'row', gap: Spacing.two },
  slotChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  plan: { alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.two },
  centered: { padding: Spacing.six, alignItems: 'center' },
});
