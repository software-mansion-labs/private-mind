# Nexio OS — Design System

## Inspiration

FataPlus OS v2 (desktop-style HTML/CSS dashboard)
- Eclipse #0C0F0C background
- Lime #9FE870 accent
- Inter + JetBrains Mono fonts
- Blur, spring animations, card-based UI

## Tokens

See `packages/ui/tokens.ts` for the canonical definitions.

## Surfaces

- **Mobile (Box mode)**: Fullscreen kiosk, dark theme, touch-first
- **Mobile (Client mode)**: Companion app, alerts, chat, camera live
- **Web (PWA)**: Dashboard, multi-site, admin, skills marketplace
- **Desktop (Tauri)**: Menubar, dock, window management (inspired by fataplus-os)

## Components

Shared React Native components in `packages/ui/components/`:
- Button, Card, Input, Badge
- Dock, Menubar, Window (desktop-style)
- Toast, Modal, BottomSheet

## Implementation Notes

- React Native components render on mobile + web (via react-native-web)
- Tauri wraps the web bundle for native desktop
- Design tokens are the single source of truth
