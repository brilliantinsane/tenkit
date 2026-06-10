import { ThemeColors, ThemeScheme } from '@/constants/theme';
import { createContext, useContext } from 'react';

export type AppTheme = {
  scheme: ThemeScheme;
  colors: ThemeColors;
  setScheme: (scheme: ThemeScheme) => void;
};

export const AppThemeContext = createContext<AppTheme | null>(null);

export const useTheme = () => {
  const theme = useContext(AppThemeContext);

  if (!theme) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }

  return theme;
};
