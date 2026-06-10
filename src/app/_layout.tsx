import AppTabs from '@/components/app-tabs';
import { AppThemeProvider } from '@/providers/app-theme-provider';

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AppTabs />
    </AppThemeProvider>
  );
}
