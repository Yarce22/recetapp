import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/shared/ui/controls';
import { FadeIn, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
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
      <EmptyState
        icon="checkmark-done"
        tone="sky"
        title="Nothing to buy"
        hint="Your pantry covers the week, and nothing has reached its low-stock mark."
      />
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const ticked = checked.has(item.name);
        const low = item.reasons.includes('low-stock');

        return (
          <FadeIn key={item.name} delay={stagger(index, 50)}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              accessibilityLabel={`${ticked ? 'Untick' : 'Tick off'} ${item.name}`}
              onPress={() => onToggle(item.name)}
              style={({ pressed }) => [
                styles.row,
                { backgroundColor: ticked ? theme.backgroundSelected : theme.backgroundElement },
                pressed && styles.pressed,
              ]}
            >
              <CheckBox ticked={ticked} />

              <View style={styles.text}>
                <ThemedText
                  type="smallBold"
                  themeColor={ticked ? 'textSecondary' : 'text'}
                  style={[styles.name, ticked && styles.struck]}
                >
                  {item.name}
                </ThemedText>
                {/* Why it is on the list. A bare list of words is harder to act on. */}
                <ThemedText type="small" themeColor="textSecondary">
                  {describe(item)}
                </ThemedText>
              </View>

              <View
                style={[styles.dot, { backgroundColor: low ? theme.coral : theme.blue }]}
                accessibilityElementsHidden
              />
            </Pressable>
          </FadeIn>
        );
      })}
    </View>
  );
}

/** Rounded box that pops a check in when ticked. */
function CheckBox({ ticked }: { ticked: boolean }) {
  const theme = useTheme();
  const [scale] = useState(() => new Animated.Value(ticked ? 1 : 0));

  useEffect(() => {
    const animation = ticked
      ? Animated.spring(scale, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true })
      : Animated.timing(scale, {
          toValue: 0,
          duration: 150,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        });
    animation.start();
    return () => animation.stop();
  }, [scale, ticked]);

  return (
    <View style={[styles.box, { borderColor: ticked ? theme.accent : theme.border }]}>
      <Animated.View
        style={[styles.boxFill, { backgroundColor: theme.accent, transform: [{ scale }] }]}
      >
        <Ionicons name="checkmark" size={16} color={theme.accentInk} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radius.lg,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  box: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  boxFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.half },
  name: { fontSize: 15 },
  struck: { textDecorationLine: 'line-through' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
