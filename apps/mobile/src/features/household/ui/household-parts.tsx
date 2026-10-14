import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

/** A titled block of the household screen. */
export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionText}>
        <ThemedText type="subtitle" accessibilityRole="header">
          {title}
        </ThemedText>
        {hint ? (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** A label above a form control, with an optional hint under the control. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      {children}
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/** A failure the person should read, announced to screen readers. */
export function ErrorNote({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <View accessibilityRole="alert" style={[styles.note, { backgroundColor: theme.warning }]}>
      <ThemedText type="small" style={{ color: theme.warningInk }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.three },
  sectionText: { gap: Spacing.half },
  field: { gap: Spacing.one },
  note: { padding: Spacing.three, borderRadius: Radius.lg },
});
