import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { MealPlanEntryDto, RecipeDto } from '@recetapp/contracts';

import { makeFindPlannedDish } from '@/features/meal-plan/application/find-planned-dish';
import { createMealPlanRepository } from '@/features/meal-plan/infrastructure/create-meal-plan-repository';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import { resolveRecipe } from '@/features/recipes/application/resolve-recipe';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { describeServiceError } from '@/features/recipes/ui/describe-service-error';
import { RecipeDetail, type CookStatus } from '@/features/recipes/ui/recipe-detail';
import { API_BASE_URL } from '@/shared/config/api';
import { useI18n } from '@/shared/i18n/i18n-provider';
import { EmptyState } from '@/shared/ui/controls';
import { CookingLoader } from '@/shared/ui/cooking-loader';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export default function RecipeDetailScreen() {
  // The title travels in the route because the backend keeps no record of
  // which dish an id referred to.
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const theme = useTheme();
  const { t, language } = useI18n();
  const { entries, cookRecipe } = usePantry();
  const { preferences, deviceId } = usePreferences();

  // `undefined` until the menu has been looked up, `null` when the dish is not on it.
  const [planEntry, setPlanEntry] = useState<MealPlanEntryDto | null | undefined>(undefined);
  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [servings, setServings] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cookStatus, setCookStatus] = useState<CookStatus>('idle');
  const [notUpdated, setNotUpdated] = useState<string[]>([]);

  // Cooking is tied to the recipe on screen: new servings mean new amounts, so
  // the previous "prepared" state no longer describes what is shown.
  const changeServings = (next: number) => {
    setCookStatus('idle');
    setNotUpdated([]);
    setServings(next);
  };

  const cook = async () => {
    if (!recipe || cookStatus !== 'idle') return;
    setCookStatus('cooking');
    try {
      const result = await cookRecipe({
        ingredients: recipe.ingredients.map(({ name, quantity }) => ({ name, quantity })),
      });
      setNotUpdated(result.skipped.map((line) => line.name));
      setCookStatus('done');
    } catch {
      setCookStatus('idle');
      setError(t('recipe.cookFailed'));
    }
  };

  const service = useMemo(
    () =>
      deviceId
        ? createHttpRecipeSuggestionService({ baseUrl: API_BASE_URL, deviceId, language })
        : null,
    [deviceId, language],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const found = await makeFindPlannedDish(await createMealPlanRepository())(id);
        if (!cancelled) setPlanEntry(found ?? null);
      } catch {
        // The menu is an optimisation here: without it the recipe simply comes
        // from the server as before.
        if (!cancelled) setPlanEntry(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    // Waits for the menu lookup so the recipe is requested once, with the
    // servings the stored ingredients were planned for.
    if (!service || !title || planEntry === undefined) return;

    // Guards against a race the servings stepper makes easy to hit: tapping +
    // twice starts two requests, and without this the slower one can land last
    // and overwrite the newer recipe.
    let cancelled = false;

    // Deliberate: this render IS the spinner. The rule exists to catch
    // cascading renders that achieve nothing, and this one is the feedback.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    void (async () => {
      try {
        const result = await resolveRecipe(service, {
          id,
          title,
          pantry: entries,
          preferences,
          servings,
          planEntry: planEntry ?? undefined,
        });
        if (cancelled) return;
        setRecipe(result.recipe);
        setMissing(result.missingIngredients);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        setError(describeServiceError(cause, t, 'recipe.error.generic'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // The pantry and the preferences are read when the request is made rather
    // than watched: refetching a recipe because the user edited an unrelated
    // pantry item would waste a model call and reset their servings choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, id, title, servings, planEntry]);

  if (!title) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyState
          icon="restaurant-outline"
          tone="peach"
          title={t('recipe.none.title')}
          hint={t('recipe.none.hint')}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {loading && !recipe ? (
        <View style={styles.centered}>
          <CookingLoader label={t('recipe.loader')} hint={title} />
        </View>
      ) : error && !recipe ? (
        <EmptyState
          icon="alert-circle-outline"
          tone="warning"
          title={t('recipe.failed')}
          hint={error}
        />
      ) : recipe ? (
        <>
          {error ? (
            <ThemedText
              type="small"
              style={[
                styles.inlineError,
                { backgroundColor: theme.warning, color: theme.warningInk },
              ]}
            >
              {error}
            </ThemedText>
          ) : null}
          <RecipeDetail
            recipe={recipe}
            missingIngredients={missing}
            onServingsChange={changeServings}
            cookStatus={cookStatus}
            notUpdated={notUpdated}
            onCook={() => void cook()}
          />
        </>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  inlineError: { margin: Spacing.three, padding: Spacing.three, borderRadius: Radius.lg },
});
