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

const ThemeContext = createContext<{ theme: Theme }>({
  theme: {
    ...lightTheme,
    insets: { top: 0, bottom: 0, left: 0, right: 0 },
  },
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = Appearance.getColorScheme();
  const [themeColors, setThemeColors] = useState(
    colorScheme === 'dark' ? darkTheme : lightTheme
  );
  const insets = useSafeAreaInsets();

  const theme = useMemo(
    () => ({ ...themeColors, insets }),
    [themeColors, insets]
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setThemeColors(colorScheme === 'dark' ? darkTheme : lightTheme);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
