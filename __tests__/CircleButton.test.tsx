import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import CircleButton from '../components/CircleButton';

jest.mock('react-native-gesture-handler', () => {
  const { TouchableOpacity } = require('react-native');
  return { TouchableOpacity };
});

const Icon = () => null;

const renderButton = (props = {}) =>
  render(
    <CircleButton
      icon={Icon}
      backgroundColor="#000"
      color="#fff"
      testID="btn"
      {...props}
    />
  );

const opacityOf = () =>
  StyleSheet.flatten(screen.getByTestId('btn').props.style).opacity;

describe('CircleButton', () => {
  it('looks live and takes the press when enabled', () => {
    const onPress = jest.fn();
    renderButton({ onPress });
    expect(opacityOf()).not.toBe(0.6);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalled();
  });

  it('dims itself and blocks the press when disabled (#380)', () => {
    const onPress = jest.fn();
    renderButton({ onPress, disabled: true });
    expect(opacityOf()).toBe(0.6);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('can be dimmed without being inert, so a tap can still explain itself', () => {
    const onPress = jest.fn();
    renderButton({ onPress, dimmed: true });
    expect(opacityOf()).toBe(0.6);
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalled();
  });

  it('shows a spinner instead of its icon while busy, and still reports taps', () => {
    const onPress = jest.fn();
    renderButton({ onPress, busy: true });
    expect(screen.getByTestId('btn').props.accessibilityState).toEqual({
      disabled: false,
      busy: true,
    });
    expect(screen.UNSAFE_queryByType(Icon)).toBeNull();
    fireEvent.press(screen.getByTestId('btn'));
    expect(onPress).toHaveBeenCalled();
  });
});
