import { router } from 'expo-router';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  startOfWeek,
  weekDates,
  weekStarts,
  type MealPlanEntryDto,
  type MealSlot,
} from '@recetapp/contracts';

import { makeClearSlot } from '@/features/meal-plan/application/clear-slot';
import { makeGenerateWeek } from '@/features/meal-plan/application/generate-week';
import { makeGetWeek } from '@/features/meal-plan/application/get-week';
import { makeRegenerateDay } from '@/features/meal-plan/application/regenerate-day';
import { createMealPlanRepository } from '@/features/meal-plan/infrastructure/create-meal-plan-repository';
import { WeeklyGrid } from '@/features/meal-plan/ui/weekly-grid';
import { useRefetchOnRemoteChange } from '@/features/household/ui/use-refetch-on-remote-change';
import { periodWeeks } from '@/features/menu-settings/domain/menu-settings';
import { MenuSettingsPanel } from '@/features/menu-settings/ui/menu-settings-panel';
import { useMenuSettings } from '@/features/menu-settings/ui/menu-settings-provider';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { describeServiceError } from '@/features/recipes/ui/describe-service-error';
import { API_BASE_URL } from '@/shared/config/api';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { Button, IconButton, Screen, ScreenHeader } from '@/shared/ui/controls';
import { CookingLoader } from '@/shared/ui/cooking-loader';
import { FadeIn, Skeleton } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

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

  const { settings, update: updateSettings } = useMenuSettings();
  const { slots, allowRepeats, includeIngredients, region } = settings;

  // The Mondays of the plan: one for a weekly menu, two for a biweekly one.
  const weeks = useMemo(
    () => weekStarts(todayIsoDate(), periodWeeks(settings.period)),
    [settings.period],
  );
  const weekStartDate = weeks[0];
  const scrollRef = useRef<ScrollView>(null);
  // Where each week's grid and each day card sit, for the day strip to scroll to.
  const gridY = useRef<Record<string, number>>({});
  const dayPositions = useRef<Record<string, number>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const loadPlan = useCallback(
    async (repository: Awaited<typeof repositoryPromise>) => {
      const getWeek = makeGetWeek(repository);
      return (await Promise.all(weeks.map((week) => getWeek(week)))).flat();
    },
    [weeks],
  );

  const reload = useCallback(async () => {
    setEntries(await loadPlan(await repositoryPromise));
  }, [repositoryPromise, loadPlan]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const plan = await loadPlan(await repositoryPromise);
        if (!cancelled) setEntries(plan);
      } catch {
        if (!cancelled) setReadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [repositoryPromise, loadPlan]);

  // Menu changes made by the household land in the local plan underneath us.
  useRefetchOnRemoteChange(reload);

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
        slots: weeks
          .flatMap((week) => weekDates(week))
          .flatMap((date) => slots.map((slot) => ({ date, slot }))),
        pantry,
        preferences,
        allowRepeats,
        includeIngredients,
        region,
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
    weeks,
    slots,
    allowRepeats,
    includeIngredients,
    region,
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
          weekStartDate: startOfWeek(date),
          weekStartDates: weeks,
          date,
          slots,
          pantry,
          preferences,
          allowRepeats,
          includeIngredients,
          region,
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
      weeks,
      slots,
      allowRepeats,
      includeIngredients,
      region,
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

  const today = todayIsoDate();
  const biweekly = weeks.length > 1;

  function scrollToDay(date: string) {
    const y = dayPositions.current[date];
    const gridTop = gridY.current[startOfWeek(date)];
    if (y === undefined || gridTop === undefined) return;
    scrollRef.current?.scrollTo({ y: gridTop + y - Spacing.three, animated: true });
  }

  return (
    <Screen>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        <ScreenHeader
          eyebrow={t(biweekly ? 'menu.weeksOf' : 'menu.weekOf', {
            date: formatDate(weekStartDate),
          })}
          title={t('menu.title')}
          action={
            <View style={styles.actions}>
              <IconButton
                icon="options-outline"
                tone="lavender"
                accessibilityLabel={t(settingsOpen ? 'menu.settings.close' : 'menu.settings.open')}
                onPress={() => setSettingsOpen((open) => !open)}
              />
              <Button
                label={planning ? t('menu.planning') : t('menu.plan')}
                variant="soft"
                tone="lavender"
                icon="refresh"
                disabled={planning || pantry.length === 0}
                onPress={planWeek}
                style={styles.planButton}
              />
            </View>
          }
        />

        <View style={styles.controls}>
          {weeks.map((week, weekIndex) => (
            <View key={week} style={styles.strip}>
              {weekDates(week).map((date, index) => {
                const isToday = date === today;
                return (
                  <FadeIn key={date} delay={(weekIndex * 7 + index) * 40} style={styles.stripCell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('menu.goToDay', {
                        day: biweekly
                          ? `${weekdayName(index)} (${t('menu.weekNumber', { number: weekIndex + 1 })})`
                          : weekdayName(index),
                      })}
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
          ))}

          {settingsOpen ? (
            <MenuSettingsPanel settings={settings} onChange={(next) => void updateSettings(next)} />
          ) : null}

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
          weeks.map((week, weekIndex) => (
            // Siblings inside the scroll content, so the grid's layout offset is
            // measured against the content the day strip scrolls.
            <Fragment key={week}>
              {biweekly ? (
                <ThemedText type="subtitle" style={styles.weekLabel}>
                  {t('menu.weekNumber', { number: weekIndex + 1 })}
                </ThemedText>
              ) : null}
              <View onLayout={(event) => (gridY.current[week] = event.nativeEvent.layout.y)}>
                <WeeklyGrid
                  weekStartDate={week}
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
            </Fragment>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.five },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  planButton: { minHeight: 44, paddingHorizontal: Spacing.three },
  weekLabel: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
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
  message: { padding: Spacing.three, borderRadius: Radius.lg },
  skeletons: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  skeletonDay: { padding: Spacing.three, borderRadius: Radius.xl, gap: 12 },
});
