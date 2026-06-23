import { DEFAULT_ACCENT, type AccentHsl } from '@/constants/theme';

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeHexColor(color: unknown): string | null {
  if (typeof color !== 'string' || !HEX_COLOR_PATTERN.test(color)) {
    return null;
  }

  const hex = color.toUpperCase();

  if (hex.length === 4) {
    const [, r, g, b] = hex;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return hex;
}

function hexToAccentHsl(hex: string): AccentHsl {
  const value = hex.slice(1);
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  if (delta === 0) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h = 0;

  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }

  return {
    h: Math.round((h * 60 + 360) % 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function resolveActiveSetupAccent(accent: unknown): AccentHsl {
  const hex = normalizeHexColor(accent);

  if (!hex) {
    return DEFAULT_ACCENT;
  }

  return hexToAccentHsl(hex);
}
