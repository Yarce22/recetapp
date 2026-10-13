import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactElement } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Badge, EmptyState, IconTile } from '@/shared/ui/controls';
import { FadeIn, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import { isLowStock } from '../domain/pantry-item';
import type { PantryEntry } from '../domain/pantry-repository';

import { CATEGORY_STYLE } from './category-style';
import { formatQuantity } from './format-quantity';

export type PantryListProps = {
  entries: PantryEntry[];
  onSelect: (entry: PantryEntry) => void;
  /** Rendered above the rows and scrolls with them. */
  header?: ReactElement | null;
};

/**
 * Presentational list of pantry entries.
 *
 * Receives data and callbacks as props and knows nothing about use cases or
 * storage, which is what keeps it renderable in a test without a database.
 */
export function PantryList({ entries, onSelect, header = null }: PantryListProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        {header}
        <EmptyState
          icon="basket-outline"
          tone="mint"
          title="There is nothing in your pantry yet"
          hint="Add what you have at home and RecetApp can start proposing dishes."
        />
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(entry) => entry.ingredient.id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.list}
      renderItem={({ item: entry, index }) => (
        <FadeIn delay={stagger(index)}>
          <PantryRow entry={entry} onSelect={onSelect} />
        </FadeIn>
      )}
    />
  );
}

function PantryRow({
  entry,
  onSelect,
}: {
  entry: PantryEntry;
  onSelect: PantryListProps['onSelect'];
}) {
  const theme = useTheme();
  const low = isLowStock(entry.item);
  const category = CATEGORY_STYLE[entry.ingredient.category];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Removes it from the pantry"
      onPress={() => onSelect(entry)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement },
        pressed && styles.pressed,
      ]}
    >
      <IconTile icon={category.icon} tone={category.tone} />
      <View style={styles.rowText}>
        <ThemedText type="smallBold" style={styles.name}>
          {entry.ingredient.displayName}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatQuantity(entry.item.quantity)}
        </ThemedText>
      </View>
      {low ? <Badge label="Low" tone="warning" /> : null}
      <Ionicons name="close" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.four,
    paddingBottom: 120,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  rowText: { flex: 1, gap: Spacing.half },
  name: { fontSize: 15 },
  emptyWrap: { flex: 1, paddingHorizontal: Spacing.four },
});
