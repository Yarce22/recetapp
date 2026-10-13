import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

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
import { Button, Chip, Screen, ScreenHeader, SegmentedControl } from '@/shared/ui/controls';
import { CookingLoader } from '@/shared/ui/cooking-loader';
import { FadeIn, Skeleton, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
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
      deviceId ? createHttpRecipeSuggestionService({ baseUrl: API_BASE_URL, deviceId }) : null,
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
  const canAsk = !loading && ready && entries.length > 0;

  const controls = (
    <View style={styles.controls}>
      <SegmentedControl
        options={MODES}
        value={preferences.suggestionMode}
        onChange={setMode}
        tone="mint"
      />

      <View style={styles.staplesBlock}>
        <ThemedText type="small" themeColor="textSecondary">
          Staples assumed available. Tap to turn one off.
        </ThemedText>
        <View style={styles.staples}>
          {STAPLES.map((staple) => (
            <Chip
              key={staple}
              label={staple}
              tone="butter"
              accessibilityRole="switch"
              stateKey="checked"
              selected={preferences.staples.includes(staple)}
              onPress={() => toggleStapleByName(staple)}
            />
          ))}
        </View>
      </View>

      <Button
        label={loading ? 'Thinking...' : 'What can I cook?'}
        icon="sparkles"
        disabled={!canAsk}
        onPress={ask}
      />

      {entries.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          Add something to your pantry first.
        </ThemedText>
      ) : null}

      {error ? (
        <View style={[styles.error, { backgroundColor: theme.warning }]}>
          <ThemedText type="small" style={{ color: theme.warningInk }}>
            {error}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );

  if (asked && !loading) {
    return (
      <Screen>
        <ScreenHeader title="Discover" />
        <SuggestionList
          suggestions={suggestions}
          filteredOut={filteredOut}
          mode={preferences.suggestionMode}
          header={controls}
          onSelect={(suggestion) =>
            // The title travels with the id: the backend is stateless and
            // cannot look up what the id referred to.
            router.push({
              pathname: '/recipe/[id]',
              params: { id: suggestion.id, title: suggestion.title },
            })
          }
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Discover" />
      <ScrollView contentContainerStyle={styles.scroll}>
        {controls}
        {loading ? (
          <View>
            <CookingLoader
              label="Mixing your ingredients"
              hint={`Looking for dishes with your ${entries.length} ingredients`}
            />
            <View style={styles.skeletons}>
              {[0, 1, 2].map((index) => (
                <FadeIn
                  key={index}
                  delay={stagger(index, 150)}
                  style={[styles.skeletonCard, { backgroundColor: theme.backgroundElement }]}
                >
                  <Skeleton width={64} height={64} radius={Radius.lg} />
                  <View style={styles.skeletonText}>
                    <Skeleton width="80%" height={14} />
                    <Skeleton width="55%" height={10} />
                    <Skeleton width="40%" height={8} />
                  </View>
                </FadeIn>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const MODES = [
  { value: 'strict', label: 'Only what I have' },
  { value: 'flexible', label: 'I can buy a little' },
] as const;

const STAPLES = ['water', 'salt', 'pepper', 'cooking oil', 'sugar', 'flour'];

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.five },
  controls: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three, gap: Spacing.three },
  staplesBlock: { gap: Spacing.two },
  staples: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  error: { padding: Spacing.three, borderRadius: Radius.lg },
  skeletons: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  skeletonCard: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: 12,
    borderRadius: Radius.xl,
  },
  skeletonText: { flex: 1, justifyContent: 'center', gap: Spacing.two },
});
