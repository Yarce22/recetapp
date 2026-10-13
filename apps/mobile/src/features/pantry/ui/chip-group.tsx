import { StyleSheet, View } from 'react-native';

import { Chip } from '@/shared/ui/controls';
import { ThemedText } from '@/shared/ui/themed-text';
import { Spacing, type Tone } from '@/shared/ui/theme';

export type ChipGroupProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  /** Display text per option; the raw value is shown when missing. */
  labels?: Partial<Record<T, string>>;
  /** Pastel per option; mint when missing. */
  tones?: Partial<Record<T, Tone>>;
};

/** Single-choice selector rendered as a row of chips. */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  labels,
  tones,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.group}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {label}
      </ThemedText>
      <View style={styles.options} accessibilityRole="radiogroup">
        {options.map((option) => (
          <Chip
            key={option}
            label={labels?.[option] ?? option}
            tone={tones?.[option] ?? 'mint'}
            selected={option === value}
            onPress={() => onChange(option)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
