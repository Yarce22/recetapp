import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { Button, controlStyles } from '@/shared/ui/controls';
import { FadeIn } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import type { AddPantryItemInput } from '../application/add-pantry-item';
import { InvalidIngredientError, InvalidQuantityError } from '../domain/errors';
import type { IngredientCategory } from '../domain/ingredient';
import { makeQuantity } from '../domain/quantity';
import type { Unit } from '../domain/units';

import { CATEGORY_STYLE, categoryLabel } from './category-style';
import { ChipGroup } from './chip-group';

const CATEGORIES = ['produce', 'dairy', 'meat', 'grain', 'spice', 'other'] as const;
const UNITS = ['g', 'kg', 'ml', 'l', 'unit'] as const;

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
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<Unit>('g');
  const [category, setCategory] = useState<IngredientCategory>('other');
  const [threshold, setThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);

  const categoryLabels = Object.fromEntries(
    CATEGORIES.map((category) => [category, categoryLabel(t, category)]),
  ) as Record<IngredientCategory, string>;
  const unitLabels = Object.fromEntries(
    UNITS.map((value) => [value, t(`unit.${value}`)]),
  ) as Record<Unit, string>;

  const inputStyle = [
    controlStyles.input,
    { backgroundColor: theme.backgroundElement, color: theme.text },
  ];

  async function handleSubmit() {
    setError(null);

    const parsedAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(parsedAmount)) {
      setError(t('form.error.amount'));
      return;
    }

    const parsedThreshold = threshold.trim() === '' ? null : Number(threshold.replace(',', '.'));
    if (parsedThreshold !== null && !Number.isFinite(parsedThreshold)) {
      setError(t('form.error.threshold'));
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
      // Domain errors carry English text meant for logs; the user gets the
      // same fact in their own language.
      setError(
        cause instanceof InvalidIngredientError
          ? t('form.error.name')
          : cause instanceof InvalidQuantityError
            ? t('form.error.negative')
            : t('form.error.save'),
      );
    }
  }

  return (
    <FadeIn distance={40} style={styles.form}>
      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('form.ingredient')}
        </ThemedText>
        <TextInput
          accessibilityLabel={t('form.ingredient')}
          value={name}
          onChangeText={setName}
          placeholder={t('form.ingredientPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
      </View>

      <ChipGroup
        label={t('form.category')}
        options={CATEGORIES}
        value={category}
        onChange={setCategory}
        labels={categoryLabels}
        tones={CATEGORY_TONES}
      />

      <View style={styles.field}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          {t('form.amount')}
        </ThemedText>
        <TextInput
          accessibilityLabel={t('form.amount')}
          value={amount}
          onChangeText={setAmount}
          placeholder={t('form.amountPlaceholder')}
          keyboardType="decimal-pad"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />
      </View>

      <ChipGroup
        label={t('form.unit')}
        options={UNITS}
        value={unit}
        onChange={setUnit}
        labels={unitLabels}
        tones={{}}
      />

      <View style={[styles.reminder, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">{t('form.threshold.title')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t('form.threshold.hint')}
        </ThemedText>
        <TextInput
          accessibilityLabel={t('form.threshold.label')}
          value={threshold}
          onChangeText={setThreshold}
          placeholder={t('form.thresholdPlaceholder')}
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
        label={submitting ? t('form.saving') : t('pantry.add')}
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
