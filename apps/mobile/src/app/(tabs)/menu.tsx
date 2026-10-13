import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { startOfWeek, weekDates, type MealPlanEntryDto, type MealSlot } from '@recetapp/contracts';

import { makeClearSlot } from '@/features/meal-plan/application/clear-slot';
import { makeGenerateWeek } from '@/features/meal-plan/application/generate-week';
import { makeGetWeek } from '@/features/meal-plan/application/get-week';
import { makeRegenerateDay } from '@/features/meal-plan/application/regenerate-day';
import { createMealPlanRepository } from '@/features/meal-plan/infrastructure/create-meal-plan-repository';
import { WeeklyGrid } from '@/features/meal-plan/ui/weekly-grid';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { describeServiceError } from '@/features/recipes/ui/describe-service-error';
import { API_BASE_URL } from '@/shared/config/api';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { Button, Chip, Screen, ScreenHeader } from '@/shared/ui/controls';
import { CookingLoader } from '@/shared/ui/cooking-loader';
import { FadeIn, Skeleton } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
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
  const { t, language, formatDate, weekdayName } = useI18n();
  const { entries: pantry } = usePantry();
  const { preferences, deviceId } = usePreferences();

  const weekStartDate = useMemo(() => startOfWeek(todayIsoDate()), []);
  const scrollRef = useRef<ScrollView>(null);
  // Where the grid and each day card sit, for the day strip to scroll to.
  const gridY = useRef(0);
  const dayPositions = useRef<Record<string, number>>({});

  // Dinner only by default. Asking one model call for 21 genuinely different
  // dishes produces repetition; the user can widen it when they want to.
  const [slots, setSlots] = useState<MealSlot[]>(['dinner']);
  const [entries, setEntries] = useState<MealPlanEntryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A flag, not text, so reading the plan does not depend on the language.
  const [readFailed, setReadFailed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const service = useMemo(
    () =>
      deviceId
        ? createHttpRecipeSuggestionService({ baseUrl: API_BASE_URL, deviceId, language })
        : null,
    [deviceId, language],
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
        if (!cancelled) setReadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise, weekStartDate]);

  const describeFailure = useCallback(
    (cause: unknown) => describeServiceError(cause, t, 'menu.error.generic'),
    [t],
  );

  const describeUnfilled = useCallback(
    (count: number): string | null =>
      // Saying so beats leaving gaps the user has to notice and explain.
      count === 0 ? null : t('menu.unfilled', { count }),
    [t],
  );

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
  }, [
    service,
    repositoryPromise,
    weekStartDate,
    slots,
    pantry,
    preferences,
    reload,
    describeFailure,
    describeUnfilled,
  ]);

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
    [
      service,
      repositoryPromise,
      weekStartDate,
      slots,
      pantry,
      preferences,
      reload,
      describeFailure,
      describeUnfilled,
    ],
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

  const days = weekDates(weekStartDate);
  const today = todayIsoDate();

  function scrollToDay(date: string) {
    const y = dayPositions.current[date];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: gridY.current + y - Spacing.three, animated: true });
  }

  return (
    <Screen>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        <ScreenHeader
          eyebrow={t('menu.weekOf', { date: formatDate(weekStartDate) })}
          title={t('menu.title')}
          action={
            <Button
              label={planning ? t('menu.planning') : t('menu.plan')}
              variant="soft"
              tone="lavender"
              icon="refresh"
              disabled={planning || pantry.length === 0}
              onPress={planWeek}
              style={styles.planButton}
            />
          }
        />

        <View style={styles.controls}>
          <View style={styles.strip}>
            {days.map((date, index) => {
              const isToday = date === today;
              return (
                <FadeIn key={date} delay={index * 40} style={styles.stripCell}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('menu.goToDay', { day: weekdayName(index) })}
                    onPress={() => scrollToDay(date)}
                    style={[
                      styles.stripDay,
                      { backgroundColor: isToday ? theme.primary : theme.backgroundElement },
                    ]}
                  >
                    <ThemedText
                      type="eyebrow"
                      style={{ color: isToday ? theme.onPrimary : theme.textSecondary }}
                    >
                      {weekdayName(index, 'short')}
                    </ThemedText>
                    <ThemedText
                      type="smallBold"
                      style={{ fontSize: 17, color: isToday ? theme.onPrimary : theme.text }}
                    >
                      {Number(date.slice(8))}
                    </ThemedText>
                  </Pressable>
                </FadeIn>
              );
            })}
          </View>

          <View style={styles.slotPicker}>
            {ALL_SLOTS.map((slot) => (
              <Chip
                key={slot}
                label={t(`meal.${slot}`)}
                tone="lavender"
                accessibilityRole="switch"
                stateKey="checked"
                accessibilityLabel={t('menu.planMeal', { meal: t(`meal.${slot}`) })}
                selected={slots.includes(slot)}
                onPress={() => toggleSlot(slot)}
              />
            ))}
          </View>

          {pantry.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('pantry.addFirst')}
            </ThemedText>
          ) : null}
          {error || readFailed ? (
            <View style={[styles.message, { backgroundColor: theme.warning }]}>
              <ThemedText type="small" style={{ color: theme.warningInk }}>
                {error ?? t('menu.error.read')}
              </ThemedText>
            </View>
          ) : null}
          {notice ? (
            <View style={[styles.message, { backgroundColor: theme.butter }]}>
              <ThemedText type="small" style={{ color: theme.butterInk }}>
                {notice}
              </ThemedText>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.skeletons}>
            {[0, 1, 2].map((index) => (
              <View
                key={index}
                style={[styles.skeletonDay, { backgroundColor: theme.backgroundElement }]}
              >
                <Skeleton width="40%" height={16} />
                <Skeleton width="85%" height={12} />
              </View>
            ))}
          </View>
        ) : planning ? (
          <CookingLoader label={t('menu.loader.label')} hint={t('menu.loader.hint')} />
        ) : (
          <View onLayout={(event) => (gridY.current = event.nativeEvent.layout.y)}>
            <WeeklyGrid
              weekStartDate={weekStartDate}
              slots={slots}
              entries={entries}
              busyDate={busyDate}
              today={today}
              onDayLayout={(date, y) => (dayPositions.current[date] = y)}
              onSelect={(entry) =>
                router.push({
                  pathname: '/recipe/[id]',
                  params: { id: entry.dishId, title: entry.dishTitle },
                })
              }
              onClear={clearSlot}
              onRegenerateDay={regenerateDay}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.five },
  planButton: { minHeight: 44, paddingHorizontal: Spacing.three },
  controls: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.three },
  strip: { flexDirection: 'row', gap: 6 },
  stripCell: { flex: 1 },
  stripDay: {
    height: 60,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  slotPicker: { flexDirection: 'row', gap: Spacing.two },
  message: { padding: Spacing.three, borderRadius: Radius.lg },
  skeletons: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  skeletonDay: { padding: Spacing.three, borderRadius: Radius.xl, gap: 12 },
});
