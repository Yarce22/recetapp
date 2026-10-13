import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { useTranslation } from '@/shared/i18n/i18n-provider';
import type { TranslationKey } from '@/shared/i18n/catalog';
import { toneColors, Typeface, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';
import type { IconName } from '@/shared/ui/controls';

/** Each tab owns a pastel; its icon sits in a pill of that color when active. */
const TABS: { name: string; title: TranslationKey; icon: IconName; tone: Tone }[] = [
  { name: 'index', title: 'tabs.pantry', icon: 'basket', tone: 'mint' },
  { name: 'discover', title: 'tabs.discover', icon: 'sparkles', tone: 'butter' },
  { name: 'menu', title: 'tabs.menu', icon: 'calendar', tone: 'lavender' },
  { name: 'shopping', title: 'tabs.shopping', icon: 'cart', tone: 'sky' },
];

export default function TabsLayout() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarLabelStyle: { fontFamily: Typeface.bodyBold, fontSize: 12 },
        tabBarStyle: {
          backgroundColor: theme.backgroundElement,
          borderTopWidth: 0,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingTop: 8,
          shadowColor: '#7A6250',
          shadowOpacity: 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -6 },
          elevation: 8,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.title),
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 52,
                  height: 30,
                  borderRadius: 15,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? toneColors(theme, tab.tone).fill : 'transparent',
                }}
              >
                <Ionicons
                  name={focused ? tab.icon : (`${tab.icon}-outline` as IconName)}
                  color={color}
                  size={20}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
