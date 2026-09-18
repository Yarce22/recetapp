import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

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
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Spacing } from '@/shared/ui/theme';

export default function RecipeDetailScreen() {
  // The title travels in the route because the backend keeps no record of
  // which dish an id referred to.
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
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

  const load = useCallback(
    async (wanted?: number) => {
      if (!service || !title) return;

      setLoading(true);
      setError(null);
      try {
        const result = await service.recipe({
          id,
          title,
          pantry: entries,
          preferences,
          servings: wanted,
        });
        setRecipe(result.recipe);
        setMissing(result.missingIngredients);
      } catch (cause) {
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
        setLoading(false);
      }
    },
    [service, id, title, entries, preferences],
  );

  useEffect(() => {
    void load(servings);
    // Reloading on every pantry keystroke would be wasteful; the recipe is
    // fetched for the id, the title and the chosen servings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, id, title, servings]);

  if (!title) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="small">Open this recipe from the Discover tab.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.screen}>
      {loading && !recipe ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : error && !recipe ? (
        <View style={styles.centered}>
          <ThemedText type="small">{error}</ThemedText>
        </View>
      ) : recipe ? (
        <>
          {error ? (
            <ThemedText type="small" style={styles.inlineError}>
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
  inlineError: { padding: Spacing.three },
});
