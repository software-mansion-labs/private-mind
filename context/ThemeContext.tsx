// ThemeContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { Appearance } from 'react-native';
import { darkTheme, lightTheme, ThemeType } from '../styles/colors';

const ThemeContext = createContext<{ theme: ThemeType }>({ theme: lightTheme });

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const colorScheme = Appearance.getColorScheme();
  const [theme, setTheme] = useState(
    colorScheme === 'dark' ? darkTheme : lightTheme
  );

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setTheme(colorScheme === 'dark' ? darkTheme : lightTheme);
    });

    return () => subscription.remove();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
