import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Shadow, Spacing, toneColors, Typeface, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

/** Full-height screen body on the cream background, clear of the status bar. */
export function Screen({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

/** Big rounded title with an optional line above it and an action beside it. */
export function ScreenHeader({
  title,
  eyebrow,
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        {eyebrow ? (
          <ThemedText type="small" themeColor="textSecondary">
            {eyebrow}
          </ThemedText>
        ) : null}
        <ThemedText type="title">{title}</ThemedText>
      </View>
      {action}
    </View>
  );
}

export function Card({ tone, style, children, ...rest }: ViewProps & { tone?: Tone }) {
  const theme = useTheme();
  const backgroundColor = tone ? theme[tone] : theme.backgroundElement;

  return (
    <View style={[styles.card, { backgroundColor }, style]} {...rest}>
      {children}
    </View>
  );
}

export type ButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** `primary` is the dark, filled call to action; `soft` a pastel one. */
  variant?: 'primary' | 'soft';
  tone?: Tone;
  icon?: IconName;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
};

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  tone = 'mint',
  icon,
  accessibilityLabel,
  style,
  children,
}: ButtonProps) {
  const theme = useTheme();
  const colors =
    variant === 'primary' ? { fill: theme.primary, ink: theme.onPrimary } : toneColors(theme, tone);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: colors.fill, opacity: disabled ? 0.45 : 1 },
        pressed && styles.pressed,
        style,
      ]}
    >
      {children}
      {icon ? <Ionicons name={icon} size={18} color={colors.ink} /> : null}
      <ThemedText type="smallBold" style={[styles.buttonLabel, { color: colors.ink }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  disabled = false,
  tone,
  size = 44,
}: {
  icon: IconName;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: Tone;
  size?: number;
}) {
  const theme = useTheme();
  const colors = tone
    ? toneColors(theme, tone)
    : { fill: theme.backgroundElement, ink: theme.text };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: colors.fill,
          opacity: disabled ? 0.45 : 1,
        },
        pressed && styles.pressed,
      ]}
    >
      <Ionicons name={icon} size={Math.round(size * 0.42)} color={colors.ink} />
    </Pressable>
  );
}

export type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: Tone;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  /** Switch-style chips report `checked`; choice chips report `selected`. */
  stateKey?: 'selected' | 'checked';
};

/**
 * Rounded pill. Selected chips are filled with their tone and outlined in its
 * ink; unselected ones sit quietly on white.
 */
export function Chip({
  label,
  selected,
  onPress,
  tone = 'mint',
  accessibilityRole = 'radio',
  accessibilityLabel,
  stateKey = 'selected',
}: ChipProps) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);

  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ [stateKey]: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.fill, borderColor: colors.ink }
          : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText
        type={selected ? 'smallBold' : 'small'}
        style={{ color: selected ? colors.ink : theme.textSecondary }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

export type SegmentedOption<T extends string> = { value: T; label: string };

/** Two or three mutually exclusive options in one white track. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  tone = 'mint',
}: {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone?: Tone;
}) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.segmented, { backgroundColor: theme.backgroundElement }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: colors.fill }]}
          >
            <ThemedText
              type={selected ? 'smallBold' : 'small'}
              numberOfLines={1}
              style={{ color: selected ? colors.ink : theme.textSecondary }}
            >
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rounded square holding an icon on a pastel fill. */
export function IconTile({ icon, tone, size = 44 }: { icon: IconName; tone: Tone; size?: number }) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: colors.fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={Math.round(size * 0.46)} color={colors.ink} />
    </View>
  );
}

/** Pastel pill with short text, for status like "Low" or "Ready to cook". */
export function Badge({ label, tone }: { label: string; tone: Tone }) {
  const theme = useTheme();
  const colors = toneColors(theme, tone);

  return (
    <View style={[styles.badge, { backgroundColor: colors.fill }]}>
      <ThemedText type="eyebrow" style={{ color: colors.ink }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Centered empty or error message with a pastel icon above it. */
export function EmptyState({
  icon,
  tone = 'lavender',
  title,
  hint,
}: {
  icon: IconName;
  tone?: Tone;
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.empty}>
      <IconTile icon={icon} tone={tone} size={72} />
      <ThemedText type="subtitle" style={styles.centerText}>
        {title}
      </ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export const controlStyles = StyleSheet.create({
  input: {
    height: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.lg,
    fontSize: 16,
    fontFamily: Typeface.body,
  },
  floating: Shadow.soft,
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
  headerText: { flex: 1, gap: Spacing.half },
  card: { borderRadius: Radius.xl, padding: Spacing.three },
  button: {
    minHeight: 54,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonLabel: { fontSize: 16 },
  pressed: { transform: [{ scale: 0.97 }] },
  iconButton: { alignItems: 'center', justifyContent: 'center', ...Shadow.soft },
  chip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    padding: 5,
    gap: 4,
    borderRadius: Radius.lg,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.five,
  },
  centerText: { textAlign: 'center' },
});
