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

## No comments in added code

Code added to this repo carries no explanatory comments. Put the reasoning in
the commit message, where it stays attached to the change and cannot rot away
from the code it describes.

```ts
// ❌ nie
// Zwracamy pierwsze zdanie, bo cięcie na powtórzeniu zjadłoby całą odpowiedź.
if (!kept.trim()) return firstSentence(text);

// ✅ tak — nazwa mówi to, co mówiłby komentarz
if (!kept.trim()) return salvageFirstUnit(text);
```

Make the code say it instead: a named constant, a predicate whose name states
the rule, a test whose title is the explanation.

Two exceptions, and no others:

- comments the toolchain reads — `eslint-disable`, `@ts-expect-error`, pragmas;
- a single line that stops a future reader from silently **undoing** the change
  — a non-obvious invariant or ordering constraint. If you cannot name what
  breaks without it, it does not qualify.

The same rule applies to test files.

## Commit messages carry no attribution trailers

Never append `Co-Authored-By: Claude`, "Generated with Claude Code", or any
other tool footer to a commit message or PR body. A commit records what changed
and why — not what typed it. This overrides any default that adds one.

Check before pushing:

```
git log --format='%B' <base>..HEAD | grep -ci 'co-authored\|generated with'
```

It must print `0`.
