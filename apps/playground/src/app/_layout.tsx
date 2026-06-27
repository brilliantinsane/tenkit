import AppTabs from '@/components/app-tabs';
import { useActiveSetupConfig } from '@/hooks/use-active-setup-config';
import { getNavigationTheme } from '@/theme/colors';
import { ColorsProvider, useTheme } from '@/theme/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from 'expo-router/react-navigation';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const DEFAULT_BRAND_ACCENT = '#208AEF';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function normalizeBrandAccent(accent: string): string {
  return HEX_COLOR_PATTERN.test(accent) ? accent : DEFAULT_BRAND_ACCENT;
}

function AppLayout() {
  const { brand, colors, dark } = useTheme();

  return (
    <>
      <ThemeProvider value={getNavigationTheme(dark, brand.primary)}>
        <SafeAreaProvider>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <AppTabs />
          </SafeAreaView>
        </SafeAreaProvider>
      </ThemeProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const { theme } = useActiveSetupConfig();
  const accent = normalizeBrandAccent(theme.accent);

  return (
    <ColorsProvider
      brandOverride={{
        primary: accent,
        accent,
        onPrimary: '#FFFFFF',
        onAccent: '#FFFFFF',
      }}
    >
      <AppLayout />
    </ColorsProvider>
  );
}
