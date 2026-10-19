import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { SharingProvider } from '@/features/household/ui/sharing-provider';
import { MenuSettingsProvider } from '@/features/menu-settings/ui/menu-settings-provider';
import { PantryProvider } from '@/features/pantry/ui/pantry-provider';
import { PreferencesProvider } from '@/features/preferences/ui/preferences-provider';
import { I18nProvider, useI18n } from '@/shared/i18n/i18n-provider';
import { AppLoading } from '@/shared/ui/app-loading';
import { Typeface } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export default function RootLayout() {
  // Outermost, so even the loading screen can speak the user's language.
  // Sharing sits right under it and never blocks rendering: it starts the
  // sync runtime in the background and reports sharing as unavailable (solo,
  // web) until it knows better.
  return (
    <I18nProvider>
      <SharingProvider>
        <RootNavigator />
      </SharingProvider>
    </I18nProvider>
  );
}

function RootNavigator() {
  const { t, status, hasChosen } = useI18n();
  const colorScheme = useColorScheme();
  const theme = useTheme();

  const [fontsLoaded, fontError] = useFonts({
    [Typeface.display]: require('../../assets/fonts/Fredoka_600SemiBold.ttf'),
    [Typeface.displayMedium]: require('../../assets/fonts/Fredoka_500Medium.ttf'),
    [Typeface.body]: require('../../assets/fonts/NunitoSans_400Regular.ttf'),
    [Typeface.bodySemiBold]: require('../../assets/fonts/NunitoSans_600SemiBold.ttf'),
    [Typeface.bodyBold]: require('../../assets/fonts/NunitoSans_700Bold.ttf'),
  });

  // A font that fails to load should not lock the user out of the app; the
  // system font is an acceptable fallback.
  if ((!fontsLoaded && !fontError) || status === 'loading') {
    return <AppLoading message={t('loading.kitchen')} />;
  }

  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.accent,
      background: theme.background,
      card: theme.background,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <PreferencesProvider>
        <MenuSettingsProvider>
          <PantryProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: theme.background },
                headerShadowVisible: false,
                headerTintColor: theme.text,
                headerTitleStyle: { fontFamily: Typeface.display, fontSize: 20 },
                contentStyle: { backgroundColor: theme.background },
              }}
            >
              {/* Nothing but the picker exists until a language is chosen, so a
                fresh install lands on it instead of on a screen in a guessed one. */}
              <Stack.Protected guard={hasChosen}>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="pantry/add"
                  options={{ title: t('pantry.add'), presentation: 'modal' }}
                />
                <Stack.Screen
                  name="recipe/[id]"
                  options={{
                    title: '',
                    headerStyle: { backgroundColor: theme.peach },
                    headerBackButtonDisplayMode: 'minimal',
                  }}
                />
                <Stack.Screen
                  name="household"
                  options={{ headerShown: false, presentation: 'modal' }}
                />
              </Stack.Protected>
              <Stack.Screen
                name="language"
                options={{ headerShown: false, presentation: 'modal', animation: 'fade' }}
              />
            </Stack>
          </PantryProvider>
        </MenuSettingsProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
