import { Text, type TextProps } from 'react-native';

import { ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const { colors } = useTheme();

  return (
    <Text
      style={[
        { color: colors[themeColor ?? 'text'] },
        type === 'default' && Typography.default,
        type === 'title' && Typography.title,
        type === 'small' && Typography.small,
        type === 'smallBold' && Typography.smallBold,
        type === 'subtitle' && Typography.subtitle,
        type === 'link' && Typography.link,
        type === 'linkPrimary' && [Typography.link, { color: colors.accent }],
        type === 'code' && Typography.code,
        style,
      ]}
      {...rest}
    />
  );
}
