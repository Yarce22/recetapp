import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { PantryProvider } from '@/features/pantry/ui/pantry-provider';
import { PreferencesProvider } from '@/features/preferences/ui/preferences-provider';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <PreferencesProvider>
        <PantryProvider>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="pantry/add"
              options={{ title: 'Add to pantry', presentation: 'modal' }}
            />
            <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
          </Stack>
        </PantryProvider>
      </PreferencesProvider>
    </ThemeProvider>
  );
}
