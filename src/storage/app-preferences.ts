import { createMMKV } from 'react-native-mmkv';

import type { ThemeScheme } from '@/constants/theme';

export const appPreferencesStorage = createMMKV({
  id: 'app-preferences',
});

const THEME_SCHEME_KEY = 'app-theme-scheme';
export const ACTIVE_RUNTIME_TENANT_ID_KEY = 'active-runtime-tenant-id';

function isThemeScheme(value: unknown): value is ThemeScheme {
  return value === 'light' || value === 'dark';
}

export function getStoredThemeScheme(): ThemeScheme | null {
  try {
    const value = appPreferencesStorage.getString(THEME_SCHEME_KEY);

    return isThemeScheme(value) ? value : null;
  } catch {
    return null;
  }
}

export function setStoredThemeScheme(scheme: ThemeScheme) {
  try {
    appPreferencesStorage.set(THEME_SCHEME_KEY, scheme);
  } catch {
    // Keep the in-memory preference even if persistence fails.
  }
}
