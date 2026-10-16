import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useMemo,
} from 'react';
import { Appearance } from 'react-native';
import { darkTheme, lightTheme, Theme } from '../styles/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemePreference, useSettingsStore } from '../store/settingsStore';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: {
    ...lightTheme,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  isDark: false,
});

const resolveIsDark = (
  preference: ThemePreference,
  systemScheme: string | null | undefined
) => {
  if (preference === 'system') return systemScheme === 'dark';
  return preference === 'dark';
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const preference = useSettingsStore((state) => state.themePreference);
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme());
  const insets = useSafeAreaInsets();

  const isDark = resolveIsDark(preference, systemScheme);

  const value = useMemo(
    () => ({
      theme: { ...(isDark ? darkTheme : lightTheme), insets },
      isDark,
    }),
    [isDark, insets]
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
