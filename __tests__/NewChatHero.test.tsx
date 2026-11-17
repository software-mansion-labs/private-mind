import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import NewChatHero, { heroPushUp } from '../components/chat-screen/NewChatHero';
import {
  NEW_CHAT_HEADING,
  NEW_CHAT_REST_BOTTOM_FRACTION,
} from '../constants/chat-screen';
import {
  ON_DEVICE_PILL,
  ON_DEVICE_PILL_HEIGHT,
} from '../components/chat-screen/OnDevicePill';
import { space } from '../constants/design-system';

const sharedValue = (value: number) =>
  ({ get: () => value }) as unknown as SharedValue<number>;

const SCREEN_HEIGHT = 844;
const HEADING_BOTTOM = SCREEN_HEIGHT * NEW_CHAT_REST_BOTTOM_FRACTION;
const PILL_SPACE = space.four + ON_DEVICE_PILL_HEIGHT;

const pillOpacity = () =>
  (
    StyleSheet.flatten(
      screen.getByTestId('on-device-pill-reveal').props.style
    ) as { opacity: number }
  ).opacity;

const heroTransform = (barHeight: number, keyboardLift: number) => {
  render(
    <NewChatHero
      screenHeight={SCREEN_HEIGHT}
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

  it('says under the heading that chats stay on the device', () => {
    heroTransform(0, 0);

    expect(screen.getByText(ON_DEVICE_PILL)).toBeTruthy();
  });

  it('keeps the pill clear of a tall bar while the keyboard is closed', () => {
    const barTop = 300;

    expect(heroTransform(SCREEN_HEIGHT - barTop, 0)).toBe(
      heroPushUp(barTop, HEADING_BOTTOM + PILL_SPACE)
    );
  });

  it('lets the keyboard push only the heading, as the pill fades away', () => {
    const barHeight = 250;
    const keyboardLift = -302;

    expect(heroTransform(barHeight, keyboardLift)).toBe(
      heroPushUp(SCREEN_HEIGHT - barHeight + keyboardLift, HEADING_BOTTOM)
    );
    expect(pillOpacity()).toBe(0);
  });

  it('shows the pill while the keyboard is closed', () => {
    heroTransform(250, 0);

    expect(pillOpacity()).toBe(1);
  });
});
