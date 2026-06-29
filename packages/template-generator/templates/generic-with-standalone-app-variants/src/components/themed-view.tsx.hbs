import { View, type ViewProps } from 'react-native';

import { type ThemeColor, useTheme } from '@/theme/ThemeContext';

export type ThemedViewProps = ViewProps & {
  type?: ThemeColor;
};

export function ThemedView({ style, type, ...otherProps }: ThemedViewProps) {
  const { brand, colors } = useTheme();
  const backgroundColor = type
    ? type in colors
      ? colors[type as keyof typeof colors]
      : brand[type as keyof typeof brand]
    : colors.background;

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
