import { useThemePreference } from './ThemeContext';

export function useColorScheme() {
  return useThemePreference().resolvedScheme;
}
