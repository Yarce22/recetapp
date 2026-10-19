import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { formatQuantity } from '@/features/pantry/ui/format-quantity';
import { useTranslation } from '@/shared/i18n/i18n-provider';
import type { Translate } from '@/shared/i18n/translator';
import { EmptyState } from '@/shared/ui/controls';
import { FadeIn, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { ShoppingListItem } from '../domain/build-shopping-list';
import type { ShoppingSource } from '../domain/shopping-source';

export type ShoppingListViewProps = {
  items: ShoppingListItem[];
  /** Ticked items, by name. Session-local: the list is derived, not stored. */
  checked: Set<string>;
  onToggle: (name: string) => void;
  /** Only changes what the empty state says. Defaults to the weekly menu. */
  source?: ShoppingSource;
};

function describe(item: ShoppingListItem, t: Translate): string {
  if (item.neededFor.length === 0) return t('shopping.reason.low');
  return t('shopping.reason.neededFor', { dishes: item.neededFor.join(', ') });
}

export function ShoppingListView({
  items,
  checked,
  onToggle,
  source = 'menu',
}: ShoppingListViewProps) {
  const theme = useTheme();
  const translator = useTranslation();
  const { t } = translator;

  if (items.length === 0) {
    return (
      <EmptyState
        icon="checkmark-done"
        tone="sky"
        title={t('shopping.empty.title')}
        hint={t(source === 'low-stock' ? 'shopping.empty.hint.lowStock' : 'shopping.empty.hint.menu')}
      />
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item, index) => {
        const ticked = checked.has(item.name);

        return (
          <FadeIn key={item.name} delay={stagger(index, 50)}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: ticked }}
              accessibilityLabel={t(ticked ? 'shopping.untick' : 'shopping.tick', {
                name: item.name,
              })}
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
                  {item.quantities && item.quantities.length > 0
                    ? ` · ${item.quantities.map((quantity) => formatQuantity(quantity, translator)).join(' + ')}`
                    : ''}
                </ThemedText>
                {/* Which dishes want it. A bare list of words is harder to act on. */}
                <ThemedText type="small" themeColor="textSecondary">
                  {describe(item, t)}
                </ThemedText>
              </View>
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
});
