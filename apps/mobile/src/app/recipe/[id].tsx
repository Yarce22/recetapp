import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { RecipeDto } from '@recetapp/contracts';

import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import {
  RateLimitedError,
  RecipeRejectedError,
  SuggestionServiceError,
} from '@/features/recipes/domain/recipe-suggestion-service';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { RecipeDetail } from '@/features/recipes/ui/recipe-detail';
import { API_BASE_URL } from '@/shared/config/api';
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
  const { entries } = usePantry();
  const { preferences, deviceId } = usePreferences();

  const [recipe, setRecipe] = useState<RecipeDto | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [servings, setServings] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const service = useMemo(
    () =>
      deviceId ? createHttpRecipeSuggestionService({ baseUrl: API_BASE_URL, deviceId }) : null,
    [deviceId],
  );

  useEffect(() => {
    if (!service || !title) return;

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
        const result = await service.recipe({
          id,
          title,
          pantry: entries,
          preferences,
          servings,
        });
        if (cancelled) return;
        setRecipe(result.recipe);
        setMissing(result.missingIngredients);
        setError(null);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof RecipeRejectedError) {
          const named = cause.ingredients.length > 0 ? `: ${cause.ingredients.join(', ')}` : '.';
          setError(`This recipe uses something you asked to avoid${named}`);
        } else if (cause instanceof RateLimitedError) {
          const minutes = Math.ceil(cause.retryAfterSeconds / 60);
          setError(`You have asked a lot in the last hour. Try again in about ${minutes} min.`);
        } else if (cause instanceof SuggestionServiceError) {
          setError(cause.message);
        } else {
          setError('Something went wrong writing that recipe.');
        }
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
  }, [service, id, title, servings]);

  if (!title) {
    return (
      <ThemedView style={styles.screen}>
        <EmptyState
          icon="restaurant-outline"
          tone="peach"
          title="No recipe here"
          hint="Open this recipe from the Discover tab."
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {loading && !recipe ? (
        <View style={styles.centered}>
          <CookingLoader label="Writing the recipe" hint={title} />
        </View>
      ) : error && !recipe ? (
        <EmptyState
          icon="alert-circle-outline"
          tone="warning"
          title="No recipe this time"
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
            onServingsChange={setServings}
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
