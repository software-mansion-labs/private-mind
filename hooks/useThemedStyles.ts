import { useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Theme } from '../styles/colors';

/**
 * Builds a memoized StyleSheet from a `createStyles(theme, ...args)` factory and
 * returns it together with the current theme, replacing the repeated
 *
 *   const { theme } = useTheme();
 *   const styles = useMemo(() => createStyles(theme), [theme]);
 *
 * boilerplate. Extra args cover parametric factories, e.g.
 * `useThemedStyles(createStyles, disabled)`.
 */
export function useThemedStyles<Args extends unknown[], T>(
  factory: (theme: Theme, ...args: Args) => T,
  ...args: Args
): { styles: T; theme: Theme } {
  const { theme } = useTheme();
  const styles = useMemo(
    () => factory(theme, ...args),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, factory, ...args]
  );
  return { styles, theme };
}
