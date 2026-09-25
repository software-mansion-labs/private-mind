import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ComposerActionButton, {
  MORPH_IN_MS,
  MORPH_OUT_MS,
  morphFillOpacity,
  morphOpacity,
  morphScale,
} from '../components/chat-screen/ComposerActionButton';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

describe('composer action morph', () => {
  it('leaves the arriving icon at full size and the leaving one small', () => {
    expect(morphOpacity(1)).toBe(1);
    expect(morphScale(1)).toBe(1);
    expect(morphOpacity(0)).toBe(0);
    expect(morphScale(0)).toBeLessThan(1);
  });

  it('lets the icon overshoot in size without overshooting in opacity', () => {
    expect(morphScale(1.1)).toBeGreaterThan(1);
    expect(morphOpacity(1.1)).toBe(1);
  });

  it('fills the circle for send and stop, leaves it bare for the mic', () => {
    expect(morphFillOpacity(1, 0)).toBe(1);
    expect(morphFillOpacity(0, 1)).toBe(1);
    expect(morphFillOpacity(0, 0)).toBe(0);
  });

  it('leaves a state faster than it enters one', () => {
    expect(MORPH_OUT_MS).toBeLessThan(MORPH_IN_MS);
  });

  it('stays quick enough not to delay a stop', () => {
    expect(MORPH_IN_MS).toBeLessThanOrEqual(200);
  });
});

describe('ComposerActionButton', () => {
  it('shows a spinner in place of the icons while a send waits', () => {
    render(
      <ComposerActionButton
        action="send"
        onPress={jest.fn()}
        busy
        disabled
        testID="send-btn"
      />
    );

    expect(screen.UNSAFE_getAllByType(ActivityIndicator)).toHaveLength(1);
    expect(screen.getByTestId('send-btn').props.enabled).toBe(false);
  });

  it('shows the icons and no spinner once nothing is waiting', () => {
    render(
      <ComposerActionButton
        action="send"
        onPress={jest.fn()}
        testID="send-btn"
      />
    );

    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
  });

  it('answers a press once it is live', () => {
    const onPress = jest.fn();
    render(
      <ComposerActionButton action="stop" onPress={onPress} testID="stop-btn" />
    );

    fireEvent.press(screen.getByTestId('stop-btn'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
