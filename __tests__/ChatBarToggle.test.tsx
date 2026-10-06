import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ChatBarToggle from '../components/chat-screen/ChatBarToggle';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const Icon = () => null;

const renderToggle = (props = {}) =>
  render(
    <ChatBarToggle
      label="Think"
      enabled
      iconOn={Icon}
      iconOff={Icon}
      onToggle={jest.fn()}
      {...props}
    />
  );

describe('ChatBarToggle for a screen reader', () => {
  it('reads an enabled toggle as a switch that is on', () => {
    renderToggle({ enabled: true });

    expect(
      screen.getByRole('switch', { name: 'Think', checked: true })
    ).toBeTruthy();
  });

  it('reads a toggle that is off as a switch that is off', () => {
    renderToggle({ enabled: false });

    expect(
      screen.getByRole('switch', { name: 'Think', checked: false })
    ).toBeTruthy();
  });

  it('reads a locked toggle as unavailable', () => {
    renderToggle({ disabled: true });

    expect(
      screen.getByRole('switch', { name: 'Think', disabled: true })
    ).toBeTruthy();
  });

  it('still flips when activated', () => {
    const onToggle = jest.fn();
    renderToggle({ onToggle });

    fireEvent.press(screen.getByRole('switch', { name: 'Think' }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
