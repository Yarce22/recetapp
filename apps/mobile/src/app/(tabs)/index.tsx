import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { PantryList } from '@/features/pantry/ui/pantry-list';
import { usePantry } from '@/features/pantry/ui/pantry-provider';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export default function PantryScreen() {
  const theme = useTheme();
  const { entries, loading, error, removeItem } = usePantry();

  return (
    <ThemedView style={styles.screen}>
      <View style={styles.header}>
        <ThemedText type="title">Pantry</ThemedText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add to pantry"
          onPress={() => router.push('/pantry/add')}
          style={[styles.add, { backgroundColor: theme.backgroundSelected }]}
        >
          <ThemedText type="smallBold">Add</ThemedText>
        </Pressable>
      </View>

      {error ? (
        <ThemedText type="small" style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator />
        </View>
      ) : (
        <PantryList entries={entries} onSelect={(entry) => removeItem(entry.ingredient.id)} />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  add: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { paddingHorizontal: Spacing.three },
});
