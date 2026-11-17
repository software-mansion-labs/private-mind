import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import NewChatHero, { heroPushUp } from '../components/chat-screen/NewChatHero';
import { NEW_CHAT_HEADING } from '../constants/chat-screen';

const sharedValue = (value: number) =>
  ({ get: () => value }) as unknown as SharedValue<number>;

const heroTransform = (barHeight: number, keyboardLift: number) => {
  render(
    <NewChatHero
      screenHeight={844}
      barHeight={sharedValue(barHeight)}
      keyboardLift={sharedValue(keyboardLift)}
    />
  );
  const style = StyleSheet.flatten(
    screen.getByTestId('new-chat-hero').props.style
  ) as { transform: { translateY: number }[] };
  return style.transform[0]!.translateY;
};

describe('the new chat hero', () => {
  it('shows the heading as a screen header', () => {
    heroTransform(0, 0);

    expect(screen.getByRole('header', { name: NEW_CHAT_HEADING })).toBeTruthy();
  });

  it('stays at rest while the bar is below it', () => {
    expect(heroPushUp(600, 340)).toBe(0);
  });

  it('is pushed up only as far as the bar overlaps it', () => {
    expect(heroPushUp(300, 340)).toBe(-56);
  });

  it('rests when the keyboard is closed and rises once it opens', () => {
    expect(heroTransform(250, 0)).toBe(0);
    expect(heroTransform(250, -302)).toBeLessThan(0);
  });
});
