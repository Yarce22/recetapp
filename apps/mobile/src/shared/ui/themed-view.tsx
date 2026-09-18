import { View, type ViewProps } from 'react-native';

import { ThemeColor } from '@/shared/ui/theme';
import { useTheme } from '@/shared/ui/use-theme';

export type ThemedViewProps = ViewProps & {
  type?: ThemeColor;
};

export function ThemedView({ style, type, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  return <View style={[{ backgroundColor: theme[type ?? 'background'] }, style]} {...otherProps} />;
}
