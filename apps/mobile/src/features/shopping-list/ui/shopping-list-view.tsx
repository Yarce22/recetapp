import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { ShoppingListItem } from '../domain/build-shopping-list';

export type ShoppingListViewProps = {
  items: ShoppingListItem[];
  /** Ticked items, by name. Session-local: the list is derived, not stored. */
  checked: Set<string>;
  onToggle: (name: string) => void;
};

function describe(item: ShoppingListItem): string {
  const parts: string[] = [];

  if (item.reasons.includes('low-stock')) parts.push('running low');
  if (item.neededFor.length > 0) parts.push(`needed for ${item.neededFor.join(', ')}`);

  return parts.join(' · ');
}

export function ShoppingListView({ items, checked, onToggle }: ShoppingListViewProps) {
  const theme = useTheme();

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <ThemedText type="subtitle">Nothing to buy</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
          Your pantry covers the week, and nothing has reached its low-stock mark.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) => {
        const ticked = checked.has(item.name);

        return (
          <Pressable
            key={item.name}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ticked }}
            accessibilityLabel={`${ticked ? 'Untick' : 'Tick off'} ${item.name}`}
            onPress={() => onToggle(item.name)}
            style={[
              styles.row,
              { backgroundColor: theme.backgroundElement, opacity: ticked ? 0.5 : 1 },
            ]}
          >
            <View style={[styles.box, { borderColor: theme.textSecondary }]}>
              {ticked ? <ThemedText type="small">x</ThemedText> : null}
            </View>

            <View style={styles.text}>
              <ThemedText type="smallBold" style={ticked ? styles.struck : undefined}>
                {item.name}
              </ThemedText>
              {/* Why it is on the list. A bare list of words is harder to act on. */}
              <ThemedText type="small" themeColor="textSecondary">
                {describe(item)}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: Spacing.three, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  box: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: Spacing.half },
  struck: { textDecorationLine: 'line-through' },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  emptyHint: { textAlign: 'center' },
});
