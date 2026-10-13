import Ionicons from '@expo/vector-icons/Ionicons';
import { LANGUAGES, type Language } from '@recetapp/contracts';
import { Pressable, StyleSheet, View } from 'react-native';

import { SteamingPot } from '@/shared/ui/app-loading';
import { Badge, IconButton, Screen } from '@/shared/ui/controls';
import { FadeIn, stagger } from '@/shared/ui/motion';
import { ThemedText } from '@/shared/ui/themed-text';
import { Radius, Shadow, Spacing } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

import { useTranslation } from './i18n-provider';
import { LANGUAGE_NAMES } from './language';
import { createTranslator } from './translator';

export type LanguagePickerProps = {
  /** The device's best match. Highlighted, never applied on its own. */
  suggested: Language;
  /** The language in use, when the picker is reopened from the app. */
  selected: Language | null;
  onSelect: (language: Language) => void;
  /** Present only when there is a screen to go back to. */
  onClose?: () => void;
};

/**
 * Two big buttons, each named in its own language.
 *
 * The question is asked in every language at once: whoever opens the app for
 * the first time cannot be assumed to read the one the app guessed.
 */
export function LanguagePicker({ suggested, selected, onSelect, onClose }: LanguagePickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Screen>
      {onClose ? (
        <View style={styles.close}>
          <IconButton icon="close" accessibilityLabel={t('language.close')} onPress={onClose} />
        </View>
      ) : null}

      <View style={styles.body}>
        <View style={[styles.plate, { backgroundColor: theme.backgroundElement }]}>
          <SteamingPot />
        </View>

        <View style={styles.titles}>
          {LANGUAGES.map((language, index) => (
            <ThemedText
              key={language}
              type={index === 0 ? 'title' : 'subtitle'}
              themeColor={index === 0 ? 'text' : 'textSecondary'}
              style={styles.centered}
            >
              {createTranslator(language).t('language.title')}
            </ThemedText>
          ))}
        </View>

        <View style={styles.options} accessibilityRole="radiogroup">
          {LANGUAGES.map((language, index) => {
            const isSelected = language === selected;
            const isSuggested = language === suggested;

            return (
              <FadeIn key={language} delay={stagger(index, 80)}>
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => onSelect(language)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: theme.backgroundElement,
                      borderColor: isSelected ? theme.accent : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.optionText}>
                    <ThemedText type="heading">{LANGUAGE_NAMES[language]}</ThemedText>
                    {isSuggested ? (
                      <Badge
                        label={createTranslator(language).t('language.suggested')}
                        tone="mint"
                      />
                    ) : null}
                  </View>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={24} color={theme.accent} />
                  ) : null}
                </Pressable>
              </FadeIn>
            );
          })}
        </View>

        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {t('language.hint')}
        </ThemedText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { alignItems: 'flex-end', padding: Spacing.three },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.four,
    padding: Spacing.four,
  },
  plate: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.soft,
  },
  titles: { gap: Spacing.one },
  centered: { textAlign: 'center' },
  options: { gap: Spacing.three },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 72,
    padding: Spacing.three,
    borderRadius: Radius.xl,
    borderWidth: 2,
  },
  optionText: { gap: Spacing.one },
  pressed: { transform: [{ scale: 0.98 }] },
});
