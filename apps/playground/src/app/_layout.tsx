import AppTabs from '@/components/app-tabs';
import { useTheme } from '@/hooks/use-theme';
import { AppThemeProvider } from '@/providers/app-theme-provider';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

function AppLayout() {
  const { colors } = useTheme();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <AppTabs />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <>
      <AppThemeProvider>
        <AppLayout />
      </AppThemeProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
    </>
  );
}
