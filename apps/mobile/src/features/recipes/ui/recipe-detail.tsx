import Ionicons from '@expo/vector-icons/Ionicons';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { normalizeIngredientName, type RecipeDto } from '@recetapp/contracts';

import { formatQuantity } from '@/features/pantry/ui/format-quantity';
import { useTranslation } from '@/shared/i18n/i18n-provider';
import { FadeIn, stagger, useLoop } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Shadow, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type RecipeDetailProps = {
  recipe: RecipeDto;
  missingIngredients: string[];
  onServingsChange: (servings: number) => void;
};

export function RecipeDetail({ recipe, missingIngredients, onServingsChange }: RecipeDetailProps) {
  const theme = useTheme();
  const translator = useTranslation();
  const { t } = translator;

  const missing = new Set(missingIngredients.map(normalizeIngredientName));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.hero, { backgroundColor: theme.peach }]}>
        <Plate />
      </View>

      <View style={styles.body}>
        <FadeIn style={styles.section}>
          <ThemedText type="heading" style={styles.title}>
            {recipe.title}
          </ThemedText>

          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: theme.mint }]}>
              <ThemedText type="eyebrow" style={{ color: theme.mintInk }}>
                {t('recipe.time')}
              </ThemedText>
              <ThemedText type="smallBold">
                {t('recipe.minutes', { minutes: recipe.timeMinutes })}
              </ThemedText>
            </View>
            <View style={[styles.stat, { backgroundColor: theme.lavender }]}>
              <ThemedText type="eyebrow" style={{ color: theme.lavenderInk }}>
                {t('recipe.difficulty')}
              </ThemedText>
              <ThemedText type="smallBold" style={styles.capitalize}>
                {/* The model's enum value, shown as a word in the user's language. */}
                {t(`difficulty.${recipe.difficulty}`)}
              </ThemedText>
            </View>
            <View style={[styles.stat, styles.servings, { backgroundColor: theme.butter }]}>
              <View>
                <ThemedText type="eyebrow" style={{ color: theme.butterInk }}>
                  {t('recipe.servings')}
                </ThemedText>
                <ThemedText
                  type="smallBold"
                  accessibilityLabel={t('recipe.servingsLabel', { count: recipe.servings })}
                >
                  {recipe.servings}
                </ThemedText>
              </View>
              <View style={styles.stepper}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('recipe.moreServings')}
                  hitSlop={8}
                  onPress={() => onServingsChange(recipe.servings + 1)}
                  style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons name="add" size={14} color={theme.text} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('recipe.fewerServings')}
                  hitSlop={8}
                  // Below one serving there is no recipe left to scale.
                  onPress={() => recipe.servings > 1 && onServingsChange(recipe.servings - 1)}
                  style={[styles.stepperButton, { backgroundColor: theme.backgroundElement }]}
                >
                  <Ionicons name="remove" size={14} color={theme.text} />
                </Pressable>
              </View>
            </View>
          </View>
        </FadeIn>

        {missingIngredients.length > 0 ? (
          <FadeIn delay={100}>
            <View style={[styles.notice, { backgroundColor: theme.warning }]}>
              <Ionicons name="cart-outline" size={20} color={theme.warningInk} />
              <ThemedText type="small" style={[styles.flex, { color: theme.warningInk }]}>
                {t('recipe.toBuy', { items: missingIngredients.join(', ') })}
              </ThemedText>
            </View>
          </FadeIn>
        ) : null}

        <FadeIn delay={150} style={styles.section}>
          <ThemedText type="subtitle">{t('recipe.ingredients')}</ThemedText>
          <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
            {recipe.ingredients.map((ingredient, index) => {
              const isMissing = missing.has(normalizeIngredientName(ingredient.name));
              return (
                <FadeIn
                  key={`${ingredient.name}-${index}`}
                  delay={stagger(index, 60, 250)}
                  distance={6}
                  style={styles.ingredient}
                >
                  <View
                    style={[
                      styles.check,
                      { backgroundColor: isMissing ? theme.warning : theme.accent },
                    ]}
                  >
                    <Ionicons
                      name={isMissing ? 'cart-outline' : 'checkmark'}
                      size={14}
                      color={isMissing ? theme.warningInk : theme.accentInk}
                    />
                  </View>
                  <ThemedText
                    type="small"
                    themeColor={isMissing ? 'textSecondary' : 'text'}
                    style={styles.flex}
                  >
                    {ingredient.optional
                      ? t('recipe.optional', { name: ingredient.name })
                      : ingredient.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatQuantity(ingredient.quantity, translator)}
                  </ThemedText>
                </FadeIn>
              );
            })}
          </View>
        </FadeIn>

        <FadeIn delay={250} style={styles.section}>
          <ThemedText type="subtitle">{t('recipe.steps')}</ThemedText>
          {recipe.steps.map((step, index) => (
            <View key={index} style={[styles.step, { backgroundColor: theme.backgroundElement }]}>
              {/* Numbered rather than bulleted: the order is the recipe. */}
              <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  {index + 1}
                </ThemedText>
              </View>
              <ThemedText type="small" style={styles.flex}>
                {step}
              </ThemedText>
            </View>
          ))}
        </FadeIn>
      </View>
    </ScrollView>
  );
}

/** A plate that turns slowly under rising steam. Decorative. */
function Plate() {
  const theme = useTheme();
  const spin = useLoop(24000, { easing: Easing.linear });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.plate, { backgroundColor: theme.backgroundElement }]}
    >
      <Animated.View
        style={[
          styles.food,
          {
            backgroundColor: theme.butter,
            transform: [
              { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
            ],
          },
        ]}
      >
        <View
          style={[
            styles.bit,
            { top: 22, left: 26, width: 30, height: 30, backgroundColor: theme.coral },
          ]}
        />
        <View
          style={[
            styles.bit,
            { top: 34, right: 24, width: 24, height: 24, backgroundColor: theme.coral },
          ]}
        />
        <View
          style={[
            styles.bit,
            { bottom: 26, left: 50, width: 40, height: 16, backgroundColor: theme.peach },
          ]}
        />
        <View
          style={[
            styles.bit,
            { top: 14, left: 70, width: 8, height: 8, backgroundColor: theme.accent },
          ]}
        />
        <View
          style={[
            styles.bit,
            { bottom: 40, right: 30, width: 8, height: 8, backgroundColor: theme.accent },
          ]}
        />
        <View
          style={[
            styles.bit,
            { top: 70, left: 18, width: 8, height: 8, backgroundColor: theme.accent },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: Spacing.six },
  hero: {
    height: 200,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  plate: {
    width: 190,
    height: 190,
    borderRadius: 95,
    marginBottom: -50,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  food: { width: 144, height: 144, borderRadius: 72 },
  bit: { position: 'absolute', borderRadius: 999 },
  body: { padding: Spacing.four, gap: Spacing.four },
  section: { gap: Spacing.three },
  title: { fontSize: 28, lineHeight: 32 },
  stats: { flexDirection: 'row', gap: Spacing.two },
  stat: { flex: 1, padding: 10, borderRadius: Radius.lg, gap: Spacing.half },
  servings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capitalize: { textTransform: 'capitalize' },
  stepper: { gap: 4 },
  stepperButton: {
    width: 28,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
  },
  card: { padding: Spacing.three, borderRadius: Radius.xl, gap: 12 },
  ingredient: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  check: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: Radius.lg,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: { flex: 1 },
});
