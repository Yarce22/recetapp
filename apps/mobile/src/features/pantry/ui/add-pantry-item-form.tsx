import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { AddPantryItemInput } from '../application/add-pantry-item';
import type { IngredientCategory } from '../domain/ingredient';
import { makeQuantity } from '../domain/quantity';
import type { Unit } from '../domain/units';

import { ChipGroup } from './chip-group';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grain', 'spice', 'other'] as const;
const UNITS = ['g', 'kg', 'ml', 'l', 'unit'] as const;

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

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

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
    <View style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
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

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
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

      <ChipGroup label="Unit" options={UNITS} value={unit} onChange={setUnit} />
      <ChipGroup label="Category" options={CATEGORIES} value={category} onChange={setCategory} />

      <View style={styles.field}>
        <ThemedText type="small" themeColor="textSecondary">
          Warn me below (optional)
        </ThemedText>
        <TextInput
          accessibilityLabel="Warn me below"
          value={threshold}
          onChangeText={setThreshold}
          placeholder="100"
          keyboardType="decimal-pad"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
      </View>

      {error ? <ThemedText type="small">{error}</ThemedText> : null}

      <Pressable
        accessibilityRole="button"
        disabled={submitting}
        onPress={handleSubmit}
        style={[styles.submit, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{submitting ? 'Saving...' : 'Add to pantry'}</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.three, padding: Spacing.three },
  field: { gap: Spacing.two },
  input: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    fontSize: 16,
  },
  submit: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginTop: Spacing.two,
  },
});
