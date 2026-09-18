import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import { isLowStock } from '../domain/pantry-item';
import type { PantryEntry } from '../domain/pantry-repository';

import { formatQuantity } from './format-quantity';

export type PantryListProps = {
  entries: PantryEntry[];
  onSelect: (entry: PantryEntry) => void;
};

/**
 * Presentational list of pantry entries.
 *
 * Receives data and callbacks as props and knows nothing about use cases or
 * storage, which is what keeps it renderable in a test without a database.
 */
export function PantryList({ entries, onSelect }: PantryListProps) {
  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText type="subtitle">There is nothing in your pantry yet</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
          Add what you have at home and RecetApp can start proposing dishes.
        </ThemedText>
      </View>
    );
  }

  return (
    <FlatList
      data={entries}
      keyExtractor={(entry) => entry.ingredient.id}
      contentContainerStyle={styles.list}
      renderItem={({ item: entry }) => <PantryRow entry={entry} onSelect={onSelect} />}
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

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onSelect(entry)}
      style={[styles.row, { backgroundColor: theme.backgroundElement }]}
    >
      <View style={styles.rowText}>
        <ThemedText type="smallBold">{entry.ingredient.displayName}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatQuantity(entry.item.quantity)}
        </ThemedText>
      </View>
      {low ? (
        <View style={[styles.badge, { backgroundColor: theme.backgroundSelected }]}>
          <ThemedText type="small">Low</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  rowText: {
    gap: Spacing.half,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.two,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyHint: {
    textAlign: 'center',
  },
});
