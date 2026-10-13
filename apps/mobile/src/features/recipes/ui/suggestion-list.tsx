import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import type { DishSuggestionDto, SuggestionMode } from '@recetapp/contracts';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Badge, EmptyState, IconTile } from '@/shared/ui/controls';
import { FadeIn, ProgressBar, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

const CARD_TONES: Tone[] = ['butter', 'peach', 'lavender', 'sky'];

export type SuggestionListProps = {
  suggestions: DishSuggestionDto[];
  /** How many the server rejected. Shown rather than hidden. */
  filteredOut: number;
  mode: SuggestionMode;
  onSelect: (suggestion: DishSuggestionDto) => void;
  /** Rendered above the cards and scrolls with them. */
  header?: ReactElement | null;
};

export function SuggestionList({
  suggestions,
  filteredOut,
  mode,
  onSelect,
  header = null,
}: SuggestionListProps) {
  const { t } = useTranslation();

  if (suggestions.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {header}
        <EmptyStateFor mode={mode} filteredOut={filteredOut} />
      </View>
    );
  }

  return (
    <FlatList
      data={suggestions}
      keyExtractor={(suggestion) => suggestion.id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      renderItem={({ item, index }) => (
        <FadeIn delay={stagger(index, 90)}>
          <SuggestionCard
            suggestion={item}
            tone={CARD_TONES[index % CARD_TONES.length]}
            featured={index === 0}
            onSelect={onSelect}
          />
        </FadeIn>
      )}
      ListFooterComponent={
        filteredOut > 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.footer}>
            {t('suggestion.moreFiltered', { count: filteredOut })}
          </ThemedText>
        ) : null
      }
    />
  );
}

function SuggestionCard({
  suggestion,
  tone,
  featured,
  onSelect,
}: {
  suggestion: DishSuggestionDto;
  tone: Tone;
  featured: boolean;
  onSelect: SuggestionListProps['onSelect'];
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const ready = suggestion.missingIngredients.length === 0;
  const percent = Math.round(suggestion.coverage * 100);
  // The first dish you can cook right now gets the big mint card.
  const hero = featured && ready;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(suggestion)}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: hero ? theme.mint : theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        <IconTile icon="restaurant-outline" tone={hero ? 'mint' : tone} size={hero ? 56 : 48} />
        <View style={styles.cardTitle}>
          {ready ? <Badge label={t('suggestion.ready')} tone="mint" /> : null}
          <ThemedText type={hero ? 'heading' : 'smallBold'} style={!hero && styles.title}>
            {suggestion.title}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        {suggestion.summary}
      </ThemedText>

      {ready ? null : (
        // Naming what is missing is more useful than a coverage percentage
        // alone: it is the shopping list for this dish.
        <ThemedText type="smallBold" style={{ color: theme.butterInk }}>
          {t('suggestion.missing', { items: suggestion.missingIngredients.join(', ') })}
        </ThemedText>
      )}

      <View style={styles.coverage}>
        <View style={styles.coverageBar}>
          <ProgressBar
            value={suggestion.coverage}
            color={ready ? theme.accent : theme.honey}
            trackColor={hero ? theme.backgroundElement : theme.track}
            accessibilityLabel={t('suggestion.coverageLabel', { percent })}
          />
        </View>
        <ThemedText type="eyebrow" themeColor="textSecondary">
          {t('suggestion.coverage', { percent })}
        </ThemedText>
      </View>
    </Pressable>
  );
}

/**
 * An empty result is an answer, not a failure, so it says which answer it is.
 *
 * In strict mode the way forward is switching mode. In flexible mode that door
 * is already open, so suggesting it again would be useless advice.
 */
function EmptyStateFor({ mode, filteredOut }: { mode: SuggestionMode; filteredOut: number }) {
  const { t } = useTranslation();

  return mode === 'strict' ? (
    <EmptyState
      icon="search-outline"
      tone="butter"
      title={t('suggestion.strictEmpty.title')}
      hint={
        filteredOut > 0
          ? t('suggestion.strictEmpty.hintFiltered', { count: filteredOut })
          : t('suggestion.strictEmpty.hint')
      }
    />
  ) : (
    <EmptyState
      icon="basket-outline"
      tone="peach"
      title={t('suggestion.flexEmpty.title')}
      hint={t('suggestion.flexEmpty.hint')}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.three },
  card: { padding: Spacing.three, borderRadius: Radius.xxl - 4, gap: Spacing.two },
  pressed: { transform: [{ scale: 0.98 }] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  cardTitle: { flex: 1, gap: Spacing.one },
  title: { fontSize: 16 },
  coverage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  coverageBar: { flex: 1 },
  footer: { paddingTop: Spacing.two, textAlign: 'center' },
  emptyWrap: { flex: 1, paddingHorizontal: Spacing.four },
});
