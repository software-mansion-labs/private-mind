/**
 * Nexio Design Tokens
 * Inspired by FataPlus OS design system (lime #9FE870 on eclipse #0C0F0C)
 */

export const colors = {
  eclipse: '#0C0F0C',
  lime: '#9FE870',
  forest: '#1B3300',
  mint: '#E2F6D5',
  stone: '#EBEBE5',
  sunlight: '#FFCD91',
  fg: '#0C0F0C',
  muted: '#6B7268',
  border: 'rgba(12,15,12,0.10)',
  cardBg: 'rgba(18,20,18,0.85)',
} as const;

export const radius = {
  pill: 9999,
  card: 20,
  sm: 12,
  md: 16,
} as const;

export const fonts = {
  display: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  body: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, monospace',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;
