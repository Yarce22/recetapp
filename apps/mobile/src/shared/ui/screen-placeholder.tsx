import { StyleSheet } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import { ThemedText } from '@/shared/ui/themed-text';
import { ThemedView } from '@/shared/ui/themed-view';
import { Spacing } from '@/shared/ui/theme';

export type ScreenPlaceholderProps = {
  title: string;
  description: string;
  phase: string;
};

/**
 * Temporary screen body used while a feature has no implementation yet.
 * Each usage names the roadmap phase that replaces it, so an unfinished
 * screen is self-documenting rather than silently empty.
 */
export function ScreenPlaceholder({ title, description, phase }: ScreenPlaceholderProps) {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">{title}</ThemedText>
      <ThemedText style={styles.description}>{description}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('placeholder.arrives', { phase })}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  description: {
    textAlign: 'center',
  },
});
