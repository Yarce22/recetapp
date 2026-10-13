/**
 * Design tokens for RecetApp's pale-pastel look.
 *
 * Every screen reads colors from here through `useTheme()`, so the palette is
 * changed in one place. The pastel tones come in pairs: a soft fill and an
 * "ink" dark enough to read on top of it (4.5:1 or better).
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2F2A35',
    textSecondary: '#6B6472',
    background: '#FBF8F3',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EFE8DE',
    border: '#DDD3C7',
    track: '#F2ECE4',
    shimmer: 'rgba(255,255,255,0.65)',
    primary: '#2F2A35',
    onPrimary: '#FFFFFF',
    accent: '#7FB79A',
    accentInk: '#1F3A2D',
    coral: '#E8A387',
    honey: '#E2C26A',
    lilac: '#A895D1',
    blue: '#6FA6C4',
    mint: '#D4EDDF',
    mintInk: '#2F4A3F',
    peach: '#F8DCCB',
    peachInk: '#7A3A1F',
    butter: '#F7EDC4',
    butterInk: '#5C4A12',
    lavender: '#E3DDF2',
    lavenderInk: '#463A66',
    sky: '#D6E8F2',
    skyInk: '#234A60',
    warning: '#FBE6DA',
    warningInk: '#8A3F22',
  },
  dark: {
    text: '#F3EEF5',
    textSecondary: '#B3ABB9',
    background: '#1B1820',
    backgroundElement: '#26222C',
    backgroundSelected: '#332E3A',
    border: '#3D3746',
    track: '#332E3A',
    shimmer: 'rgba(255,255,255,0.07)',
    primary: '#F3EEF5',
    onPrimary: '#1B1820',
    accent: '#7FB79A',
    accentInk: '#10251B',
    coral: '#E8A387',
    honey: '#E2C26A',
    lilac: '#A895D1',
    blue: '#6FA6C4',
    mint: '#2C3F35',
    mintInk: '#CDEBDA',
    peach: '#45302A',
    peachInk: '#F6D2C0',
    butter: '#403923',
    butterInk: '#F2E3AE',
    lavender: '#36304A',
    lavenderInk: '#DCD4F2',
    sky: '#263B47',
    skyInk: '#CFE4F0',
    warning: '#4A2F26',
    warningInk: '#F6C9B4',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type Theme = (typeof Colors)['light'] | (typeof Colors)['dark'];

/** A pastel fill and the ink that reads on it. */
export type Tone = 'mint' | 'peach' | 'butter' | 'lavender' | 'sky' | 'warning';

export function toneColors(theme: Theme, tone: Tone): { fill: string; ink: string } {
  return { fill: theme[tone], ink: theme[`${tone}Ink`] };
}

/**
 * Bundled typefaces, loaded in the root layout. Each weight is its own family:
 * Android ignores `fontWeight` on custom fonts, so the weight lives in the name.
 */
export const Typeface = {
  display: 'Fredoka_600SemiBold',
  displayMedium: 'Fredoka_500Medium',
  body: 'NunitoSans_400Regular',
  bodySemiBold: 'NunitoSans_600SemiBold',
  bodyBold: 'NunitoSans_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 28,
  pill: 999,
} as const;

/** Soft, warm drop shadow used on floating elements. */
export const Shadow = {
  soft: {
    shadowColor: '#7A6250',
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
