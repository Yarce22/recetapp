import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { DishSuggestionDto, SuggestionMode } from '@recetapp/contracts';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type SuggestionListProps = {
  suggestions: DishSuggestionDto[];
  /** How many the server rejected. Shown rather than hidden. */
  filteredOut: number;
  mode: SuggestionMode;
  onSelect: (suggestion: DishSuggestionDto) => void;
};

export function SuggestionList({ suggestions, filteredOut, mode, onSelect }: SuggestionListProps) {
  if (suggestions.length === 0) {
    return <EmptyState mode={mode} filteredOut={filteredOut} />;
  }

  return (
    <FlatList
      data={suggestions}
      keyExtractor={(suggestion) => suggestion.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <SuggestionCard suggestion={item} onSelect={onSelect} />}
      ListFooterComponent={
        filteredOut > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            {filteredOut} more did not fit what you have.
          </ThemedText>
        ) : null
      }
    />
  );
}

function SuggestionCard({
  suggestion,
  onSelect,
}: {
  suggestion: DishSuggestionDto;
  onSelect: SuggestionListProps['onSelect'];
}) {
  const theme = useTheme();
  const ready = suggestion.missingIngredients.length === 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(suggestion)}
      style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <ThemedText type="smallBold">{suggestion.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {suggestion.summary}
      </ThemedText>

      {ready ? (
        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small">Ready to cook</ThemedText>
        </View>
      ) : (
        // Naming what is missing is more useful than a coverage percentage:
        // it is the shopping list for this dish.
        <ThemedText type="small" themeColor="textSecondary">
          Missing: {suggestion.missingIngredients.join(', ')}
        </ThemedText>
      )}
    </Pressable>
  );
}

/**
 * An empty result is an answer, not a failure, so it says which answer it is.
 *
 * In strict mode the way forward is switching mode. In flexible mode that door
 * is already open, so suggesting it again would be useless advice.
 */
function EmptyState({ mode, filteredOut }: { mode: SuggestionMode; filteredOut: number }) {
  return (
    <View style={styles.empty}>
      {mode === 'strict' ? (
        <>
          <ThemedText type="subtitle">Nothing you can make right now</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
            {filteredOut > 0
              ? `${filteredOut} dishes needed something you do not have. Switch to flexible to see them.`
              : 'Switch to flexible to see dishes that need a couple of extra ingredients.'}
          </ThemedText>
        </>
      ) : (
        <>
          <ThemedText type="subtitle">No dishes came back</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
            Add a few more ingredients to your pantry and try again.
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two },
  card: { padding: Spacing.three, borderRadius: Spacing.two, gap: Spacing.two },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  footer: { paddingTop: Spacing.three, textAlign: 'center' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyHint: { textAlign: 'center' },
});
