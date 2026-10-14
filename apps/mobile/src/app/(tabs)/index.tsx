import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { IngredientCategory } from '@/features/pantry/domain/ingredient';
import { isLowStock } from '@/features/pantry/domain/pantry-item';
import { CATEGORY_STYLE, categoryLabel } from '@/features/pantry/ui/category-style';
import { HouseholdEntryButton } from '@/features/household/ui/household-entry-button';
import { PantryList } from '@/features/pantry/ui/pantry-list';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Chip, IconButton, IconTile, Screen, ScreenHeader } from '@/shared/ui/controls';
import { FadeIn, Skeleton, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Shadow, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

type Filter = IngredientCategory | 'all';

export default function PantryScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { entries, loading, error, removeItem } = usePantry();
  const [filter, setFilter] = useState<Filter>('all');

  const low = useMemo(() => entries.filter((entry) => isLowStock(entry.item)), [entries]);
  // Only categories the user actually has; an empty filter is a dead end.
  const categories = useMemo(
    () =>
      (Object.keys(CATEGORY_STYLE) as IngredientCategory[]).filter((category) =>
        entries.some((entry) => entry.ingredient.category === category),
      ),
    [entries],
  );
  const activeFilter = filter !== 'all' && categories.includes(filter) ? filter : 'all';
  const visible =
    activeFilter === 'all'
      ? entries
      : entries.filter((entry) => entry.ingredient.category === activeFilter);

  const header = (
    <View style={styles.listHeader}>
      {low.length > 0 ? (
        <FadeIn>
          <Pressable
            accessibilityRole="button"
            accessibilityHint={t('pantry.runningLow.hint')}
            onPress={() => router.push('/shopping')}
            style={[styles.banner, { backgroundColor: theme.warning }]}
          >
            <IconTile icon="alert-circle-outline" tone="warning" size={40} />
            <View style={styles.bannerText}>
              <ThemedText type="smallBold" style={{ color: theme.warningInk }}>
                {t('pantry.runningLow')}
              </ThemedText>
              <ThemedText type="small" numberOfLines={1} style={{ color: theme.warningInk }}>
                {low.map((entry) => entry.ingredient.displayName).join(', ')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.warningInk} />
          </Pressable>
        </FadeIn>
      ) : null}

      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <Chip
            label={t('pantry.filterAll', { count: entries.length })}
            tone="lavender"
            selected={activeFilter === 'all'}
            onPress={() => setFilter('all')}
          />
          {categories.map((category) => (
            <Chip
              key={category}
              label={categoryLabel(t, category)}
              tone={CATEGORY_STYLE[category].tone}
              selected={activeFilter === category}
              onPress={() => setFilter(category)}
            />
          ))}
        </ScrollView>
      ) : null}

      {error ? (
        <ThemedText type="small" style={{ color: theme.warningInk }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow={t('pantry.eyebrow')}
        title={t('pantry.title')}
        action={
          // Language and sharing live here, quietly: neither is used often
          // enough to compete with the pantry for attention. The sharing button
          // renders nothing where sharing is unavailable.
          <View style={styles.headerActions}>
            <HouseholdEntryButton onPress={() => router.push('/household')} />
            <IconButton
              icon="language-outline"
              accessibilityLabel={t('language.change')}
              onPress={() => router.push('/language')}
              size={40}
            />
          </View>
        }
      />

      {loading ? (
        <View style={styles.skeletons}>
          {[0, 1, 2, 3, 4].map((index) => (
            <FadeIn
              key={index}
              delay={stagger(index)}
              style={[styles.skeletonRow, { backgroundColor: theme.backgroundElement }]}
            >
              <Skeleton width={44} height={44} radius={Radius.md} />
              <View style={styles.skeletonText}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="30%" height={10} />
              </View>
            </FadeIn>
          ))}
        </View>
      ) : (
        <PantryList
          entries={visible}
          header={header}
          onSelect={(entry) => removeItem(entry.ingredient.id)}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('pantry.add')}
        onPress={() => router.push('/pantry/add')}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.accent },
          pressed && styles.fabPressed,
        ]}
      >
        <Ionicons name="add" size={30} color={theme.accentInk} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  listHeader: { gap: Spacing.three, paddingBottom: Spacing.three },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderRadius: Radius.xl,
  },
  bannerText: { flex: 1, gap: Spacing.half },
  filters: { gap: Spacing.two },
  skeletons: { paddingHorizontal: Spacing.four, gap: Spacing.two },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderRadius: Radius.lg,
  },
  skeletonText: { flex: 1, gap: Spacing.two },
  fab: {
    position: 'absolute',
    right: Spacing.four,
    bottom: Spacing.four,
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
});
