import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { toneColors, Typeface, type Tone } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';
import type { IconName } from '@/shared/ui/controls';

/** Each tab owns a pastel; its icon sits in a pill of that color when active. */
const TABS: { name: string; title: string; icon: IconName; tone: Tone }[] = [
  { name: 'index', title: 'Pantry', icon: 'basket', tone: 'mint' },
  { name: 'discover', title: 'Discover', icon: 'sparkles', tone: 'butter' },
  { name: 'menu', title: 'Menu', icon: 'calendar', tone: 'lavender' },
  { name: 'shopping', title: 'Shopping', icon: 'cart', tone: 'sky' },
];

export default function TabsLayout() {
  const theme = useTheme();

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
            title: tab.title,
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
