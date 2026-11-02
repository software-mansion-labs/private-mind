import { StyleSheet } from 'react-native';

export const PRESSED_OPACITY = 0.6;

export const DIMMED_OPACITY = 0.4;

const shared = StyleSheet.create({
  pressed: { opacity: PRESSED_OPACITY },
  dimmed: { opacity: DIMMED_OPACITY },
});

export const pressedOpacity = shared.pressed;

export const dimmedOpacity = shared.dimmed;
