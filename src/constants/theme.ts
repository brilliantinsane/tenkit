import { Platform, StyleSheet, type TextStyle } from 'react-native';

// ── HSL HELPERS ────────────────────────────────────────────────────────────────

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${h}, ${s}%, ${l}%, ${a})`;
}

// ── NEUTRAL COLORS ──────────────────────────────────────────────────────────────

export const NEUTRAL = {
  dark: {
    background: hsl(0, 0, 5),
    backgroundDark: hsl(0, 0, 0),
    backgroundLight: hsl(0, 0, 10),
    border: hsl(0, 0, 15),
    text: hsl(0, 0, 95),
    textMuted: hsl(0, 0, 70),
    placeholder: hsl(0, 0, 30),
  },
  light: {
    background: hsl(0, 0, 95),
    backgroundDark: hsl(0, 0, 90),
    backgroundLight: hsl(0, 0, 100),
    border: hsl(0, 0, 85),
    text: hsl(0, 0, 5),
    textMuted: hsl(0, 0, 30),
    placeholder: hsl(0, 0, 70),
  },
} as const;

// ── SEMANTIC COLORS ─────────────────────────────────────────────────────────────

export const SEMANTIC = {
  dark: {
    danger: hsl(0, 84, 60),
    dangerBg: hsla(0, 84, 60, 0.15),
    warning: hsl(38, 92, 50),
    warningBg: hsla(38, 92, 50, 0.15),
    success: hsl(142, 71, 45),
    successBg: hsla(142, 71, 45, 0.15),
    info: hsl(217, 91, 60),
    infoBg: hsla(217, 91, 60, 0.15),
  },
  light: {
    danger: hsl(0, 72, 51),
    dangerBg: hsla(0, 72, 51, 0.1),
    warning: hsl(38, 92, 44),
    warningBg: hsla(38, 92, 44, 0.1),
    success: hsl(142, 76, 36),
    successBg: hsla(142, 76, 36, 0.1),
    info: hsl(217, 83, 53),
    infoBg: hsla(217, 83, 53, 0.1),
  },
} as const;

// ── THEME RESOLUTION ────────────────────────────────────────────────────────────

export type ThemeScheme = 'light' | 'dark';

export type AccentHsl = {
  h: number;
  s: number;
  l: number;
};

export const DEFAULT_ACCENT: AccentHsl = { h: 209, s: 87, l: 53 };

export type ThemeColors = {
  // Neutral
  background: string;
  backgroundDark: string;
  backgroundLight: string;
  border: string;
  text: string;
  textMuted: string;
  placeholder: string;
  // Accent
  accent: string;
  accentContrast: string;
  accentGlow: string;
  accentLight: string;
  accentBg: string;
  // Semantic
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  success: string;
  successBg: string;
  info: string;
  infoBg: string;
};

export function resolveTheme(scheme: ThemeScheme, accent: AccentHsl): ThemeColors {
  const { h, s, l } = accent;
  return {
    ...NEUTRAL[scheme],
    ...SEMANTIC[scheme],
    accent: hsl(h, s, l),
    accentContrast: hsl(0, 0, 100),
    accentGlow: hsla(h, s, l, 0.3),
    accentLight: hsla(h, s, l, 0.15),
    accentBg: hsla(h, s, l, 0.1),
  };
}

export type ThemeColor = keyof ThemeColors;

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

export const Typography = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 700,
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 500,
  },
  title: {
    fontSize: 48,
    fontWeight: 600,
    lineHeight: 52,
  },
  subtitle: {
    fontSize: 32,
    lineHeight: 44,
    fontWeight: 600,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: (Platform.select({ android: '700' }) ?? '500') as TextStyle['fontWeight'],
    fontSize: 12,
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
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 14,
  pill: 24,
  full: 9999,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
