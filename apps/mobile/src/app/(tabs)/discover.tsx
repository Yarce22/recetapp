import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { DishSuggestionDto, SuggestionMode } from '@recetapp/contracts';

import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { usePreferences } from '@/features/preferences/ui/preferences-provider';
import {
  RateLimitedError,
  SuggestionServiceError,
} from '@/features/recipes/domain/recipe-suggestion-service';
import { createHttpRecipeSuggestionService } from '@/features/recipes/infrastructure/http-recipe-suggestion-service';
import { SuggestionList } from '@/features/recipes/ui/suggestion-list';
import { API_BASE_URL } from '@/shared/config/api';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export default function DiscoverScreen() {
  const theme = useTheme();
  const { entries } = usePantry();
  const { preferences, deviceId, ready, update, toggleStapleByName } = usePreferences();

  const [suggestions, setSuggestions] = useState<DishSuggestionDto[]>([]);
  const [filteredOut, setFilteredOut] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asked, setAsked] = useState(false);

  const service = useMemo(
    () =>
      deviceId
        ? createHttpRecipeSuggestionService({ baseUrl: API_BASE_URL, deviceId })
        : null,
    [deviceId],
  );

  const ask = useCallback(async () => {
    if (!service) return;

    setLoading(true);
    setError(null);
    try {
      const result = await service.suggest(entries, preferences);
      setSuggestions(result.suggestions);
      setFilteredOut(result.filteredOut);
      setAsked(true);
    } catch (cause) {
      if (cause instanceof RateLimitedError) {
        const minutes = Math.ceil(cause.retryAfterSeconds / 60);
        setError(`You have asked a lot in the last hour. Try again in about ${minutes} min.`);
      } else if (cause instanceof SuggestionServiceError) {
        setError(cause.message);
      } else {
        setError('Something went wrong looking for dishes.');
      }
    } finally {
      setLoading(false);
    }
  }, [service, entries, preferences]);

  const setMode = (mode: SuggestionMode) => update({ ...preferences, suggestionMode: mode });

  return (
    <ThemedView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.controls}>
        <ThemedText type="title">Discover</ThemedText>

        <View style={styles.modes}>
          {(['strict', 'flexible'] as const).map((mode) => (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected: preferences.suggestionMode === mode }}
              onPress={() => setMode(mode)}
              style={[
                styles.mode,
                {
                  backgroundColor:
                    preferences.suggestionMode === mode
                      ? theme.backgroundSelected
                      : theme.backgroundElement,
                },
              ]}>
              <ThemedText type="smallBold">
                {mode === 'strict' ? 'Only what I have' : 'I can buy a little'}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText type="small" themeColor="textSecondary">
          Staples assumed available. Tap to turn one off.
        </ThemedText>
        <View style={styles.staples}>
          {['water', 'salt', 'pepper', 'cooking oil', 'sugar', 'flour'].map((staple) => {
            const enabled = preferences.staples.includes(staple);
            return (
              <Pressable
                key={staple}
                accessibilityRole="switch"
                accessibilityState={{ checked: enabled }}
                onPress={() => toggleStapleByName(staple)}
                style={[
                  styles.staple,
                  {
                    backgroundColor: enabled ? theme.backgroundSelected : theme.backgroundElement,
                    opacity: enabled ? 1 : 0.5,
                  },
                ]}>
                <ThemedText type="small">{staple}</ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={loading || !ready || entries.length === 0}
          onPress={ask}
          style={[
            styles.ask,
            {
              backgroundColor: theme.backgroundSelected,
              opacity: loading || entries.length === 0 ? 0.5 : 1,
            },
          ]}>
          <ThemedText type="smallBold">
            {loading ? 'Thinking...' : 'What can I cook?'}
          </ThemedText>
        </Pressable>

        {entries.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            Add something to your pantry first.
          </ThemedText>
        ) : null}

        {error ? <ThemedText type="small">{error}</ThemedText> : null}
      </ScrollView>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : asked ? (
        <SuggestionList
          suggestions={suggestions}
          filteredOut={filteredOut}
          mode={preferences.suggestionMode}
          onSelect={(suggestion) => router.push(`/recipe/${suggestion.id}`)}
        />
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  controls: { padding: Spacing.three, gap: Spacing.three },
  modes: { flexDirection: 'row', gap: Spacing.two },
  mode: { flex: 1, alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.two },
  staples: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  staple: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  ask: { alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.two },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
