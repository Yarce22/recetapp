import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Typeface } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'heading'
    | 'eyebrow'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        styles[type],
        type === 'linkPrimary' && { color: theme.mintInk },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: { fontFamily: Typeface.body, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: Typeface.body, fontSize: 14, lineHeight: 20 },
  smallBold: { fontFamily: Typeface.bodyBold, fontSize: 14, lineHeight: 20 },
  eyebrow: { fontFamily: Typeface.bodyBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.4 },
  title: { fontFamily: Typeface.display, fontSize: 30, lineHeight: 36 },
  subtitle: { fontFamily: Typeface.displayMedium, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: Typeface.display, fontSize: 24, lineHeight: 28 },
  link: { fontFamily: Typeface.bodyBold, lineHeight: 30, fontSize: 14 },
  linkPrimary: { fontFamily: Typeface.bodyBold, lineHeight: 30, fontSize: 14 },
  code: { fontFamily: Fonts.mono, fontSize: 12 },
});
