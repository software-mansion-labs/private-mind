import { Platform } from 'react-native';
import { type Theme } from '../styles/colors';

export const SUPPORTS_USER_ACTION_MENU = Platform.OS === 'android';

export const USER_MESSAGE_BOTTOM_SPACING = 24;
export const USER_ACTION_MENU_OFFSET = 6;
export const LAYOUT_HEIGHT_CHANGE_THRESHOLD = 0.5;
export const MESSAGE_ACTION_ROW_HEIGHT = 24;

export const FADE_HEIGHT = 24;
export const FADE_GAP_TRIM = 5;
export const SEAM_OVERLAP = 1;
export const BOTTOM_FADE_HEIGHT = Platform.OS === 'ios' ? 64 : FADE_HEIGHT;

export const SCROLL_INDICATOR_GUTTER = 12;

export const GENERATION_ERROR_MEASUREMENT_KEY = 'generation-error';

export const MESSAGE_PIN_OFFSET = 8;

export const PIN_READY_SLACK_PX = 1;

export const MESSAGE_PIN_SETTLE_MS = 500;

export const REVEAL_FALLBACK_MS = 900;

export const PIN_RELEASE_MS = 32;

export const navBarInset = (theme: Theme) =>
  Platform.OS === 'android' ? theme.insets.bottom : 0;
