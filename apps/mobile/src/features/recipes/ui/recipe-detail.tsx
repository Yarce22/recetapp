import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { normalizeIngredientName, type RecipeDto } from '@recetapp/contracts';

import { formatQuantity } from '@/features/pantry/ui/format-quantity';
import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type RecipeDetailProps = {
  recipe: RecipeDto;
  missingIngredients: string[];
  onServingsChange: (servings: number) => void;
};

export function RecipeDetail({ recipe, missingIngredients, onServingsChange }: RecipeDetailProps) {
  const theme = useTheme();

  const missing = new Set(missingIngredients.map(normalizeIngredientName));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title">{recipe.title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {recipe.timeMinutes} min · {recipe.difficulty}
      </ThemedText>

      <View style={styles.servings}>
        <ThemedText type="small" themeColor="textSecondary">
          Servings
        </ThemedText>
        <View style={styles.stepper}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fewer servings"
            // Below one serving there is no recipe left to scale.
            onPress={() => recipe.servings > 1 && onServingsChange(recipe.servings - 1)}
            style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="smallBold">-</ThemedText>
          </Pressable>
          <ThemedText type="smallBold" accessibilityLabel={`${recipe.servings} servings`}>
            {recipe.servings}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="More servings"
            onPress={() => onServingsChange(recipe.servings + 1)}
            style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="smallBold">+</ThemedText>
          </Pressable>
        </View>
      </View>

      {missingIngredients.length > 0 ? (
        <View style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="small">You need to buy: {missingIngredients.join(', ')}</ThemedText>
        </View>
      ) : null}

      <ThemedText type="subtitle">Ingredients</ThemedText>
      <View style={styles.block}>
        {recipe.ingredients.map((ingredient, index) => {
          const isMissing = missing.has(normalizeIngredientName(ingredient.name));
          return (
            <View key={`${ingredient.name}-${index}`} style={styles.ingredient}>
              <ThemedText type="small" themeColor={isMissing ? 'textSecondary' : 'text'}>
                {ingredient.optional ? `${ingredient.name} (optional)` : ingredient.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatQuantity(ingredient.quantity)}
              </ThemedText>
            </View>
          );
        })}
      </View>

      <ThemedText type="subtitle">Steps</ThemedText>
      <View style={styles.block}>
        {recipe.steps.map((step, index) => (
          <View key={index} style={styles.step}>
            {/* Numbered rather than bulleted: the order is the recipe. */}
            <View style={[styles.stepNumber, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small">{index + 1}</ThemedText>
            </View>
            <ThemedText type="small" style={styles.stepText}>
              {step}
            </ThemedText>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.three, gap: Spacing.three },
  servings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  notice: { padding: Spacing.three, borderRadius: Spacing.two },
  block: { gap: Spacing.two },
  ingredient: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.three },
  step: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  stepNumber: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  stepText: { flex: 1 },
});
