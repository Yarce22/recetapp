import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Button, controlStyles } from '@/shared/ui/controls';
import { FadeIn } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { AddPantryItemInput } from '../application/add-pantry-item';
import type { IngredientCategory } from '../domain/ingredient';
import { makeQuantity } from '../domain/quantity';
import type { Unit } from '../domain/units';

import { CATEGORY_STYLE } from './category-style';
import { ChipGroup } from './chip-group';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grain', 'spice', 'other'] as const;
const UNITS = ['g', 'kg', 'ml', 'l', 'unit'] as const;

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORIES.map((category) => [category, CATEGORY_STYLE[category].label]),
) as Record<IngredientCategory, string>;
const CATEGORY_TONES = Object.fromEntries(
  CATEGORIES.map((category) => [category, CATEGORY_STYLE[category].tone]),
) as Record<IngredientCategory, Tone>;

export type AddPantryItemFormProps = {
  onSubmit: (input: AddPantryItemInput) => Promise<void>;
  submitting?: boolean;
};

/**
 * Form for adding food to the pantry.
 *
 * Validation lives in the domain factories; this component only reports what
 * they reject, so the rules cannot drift between the form and the model.
 */
export function AddPantryItemForm({ onSubmit, submitting = false }: AddPantryItemFormProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [category, setCategory] = useState<IngredientCategory>('other');
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);

  const inputStyle = [
    controlStyles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  async function handleSubmit() {
    setError(null);

    const parsedAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount)) {
      setError('Enter how much you have, as a number.');
      return;
    }

    const parsedThreshold = threshold.trim() === '' ? null : Number(threshold.replace(',', '.'));
    if (parsedThreshold !== null && !Number.isFinite(parsedThreshold)) {
      setError('The low-stock threshold has to be a number, or left empty.');
      return;
    }

    try {
      await onSubmit({
        name,
        category,
        quantity: makeQuantity(parsedAmount, unit),
        lowStockThreshold: parsedThreshold === null ? null : makeQuantity(parsedThreshold, unit),
      });
      setName('');
      setAmount('');
      setThreshold('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this item.');
    }
  }

  return (
    <FadeIn distance={40} style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Ingredient
        </ThemedText>
        <TextInput
          accessibilityLabel="Ingredient"
          value={name}
          onChangeText={setName}
          placeholder="Tomato"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
      </View>

      <ChipGroup
        label="Category"
        options={CATEGORIES}
        value={category}
        onChange={setCategory}
        labels={CATEGORY_LABELS}
        tones={CATEGORY_TONES}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          How much
        </ThemedText>
        <TextInput
          accessibilityLabel="How much"
          value={amount}
          onChangeText={setAmount}
          placeholder="500"
          keyboardType="decimal-pad"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
      </View>

      <ChipGroup label="Unit" options={UNITS} value={unit} onChange={setUnit} tones={{}} />

      <View style={[styles.reminder, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Warn me below (optional)</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          You get a reminder when it drops under this amount.
        </ThemedText>
        <TextInput
          accessibilityLabel="Warn me below"
          value={threshold}
          onChangeText={setThreshold}
          placeholder="100"
          keyboardType="decimal-pad"
          placeholderTextColor={theme.textSecondary}
          style={[inputStyle, { backgroundColor: theme.warning }]}
        />
      </View>

      {error ? (
        <ThemedText type="small" style={{ color: theme.warningInk }}>
          {error}
        </ThemedText>
      ) : null}

      <Button
        label={submitting ? 'Saving...' : 'Add to pantry'}
        icon="add-circle-outline"
        disabled={submitting}
        onPress={handleSubmit}
        style={styles.submit}
      />
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.four, padding: Spacing.four },
  field: { gap: Spacing.two },
  reminder: { gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.xl },
  submit: { marginTop: Spacing.two },
});
