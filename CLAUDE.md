# Project conventions

## Themed styles — use the `useThemedStyles` hook

Components that build a `StyleSheet` from the theme MUST obtain it via
[`useThemedStyles`](hooks/useThemedStyles.ts). Do NOT hand-roll the
`useTheme()` + `useMemo(() => createStyles(theme), [theme])` boilerplate.

```tsx
// ✅ styles only
const { styles } = useThemedStyles(createStyles);

// ✅ when the component also reads theme directly (icon colors, insets, etc.)
const { styles, theme } = useThemedStyles(createStyles);

// ✅ parametric factory — pass extra args after the factory
const { styles } = useThemedStyles(createStyles, disabled);

// ❌ do not do this
const { theme } = useTheme();
const styles = useMemo(() => createStyles(theme), [theme]);
```

- Keep the `createStyles = (theme: Theme, ...args) => StyleSheet.create({ ... })`
  factory at the bottom of the file, unchanged — the hook memoizes it.
- The hook returns `{ styles, theme }`; destructure only what you use.
- `useTheme()` from [context/ThemeContext](context/ThemeContext.tsx) is still fine
  for components that need `theme` but build no `StyleSheet`.
