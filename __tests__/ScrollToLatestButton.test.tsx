import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ScrollToLatestButton from '../components/chat-screen/ScrollToLatestButton';

jest.mock('../utils/Feedback', () => ({
  Feedback: { scrollToLatest: jest.fn() },
}));

describe('ScrollToLatestButton', () => {
  it('stays mounted while hidden so it can animate out', () => {
    render(<ScrollToLatestButton visible={false} onPress={jest.fn()} />);

    expect(screen.getByTestId('scroll-to-latest')).toBeTruthy();
  });

  it('takes no touches while hidden', () => {
    render(<ScrollToLatestButton visible={false} onPress={jest.fn()} />);

    expect(
      screen.getByTestId('scroll-to-latest-shell').props.pointerEvents
    ).toBe('none');
  });

  it('takes touches once visible', () => {
    render(<ScrollToLatestButton visible onPress={jest.fn()} />);

    expect(
      screen.getByTestId('scroll-to-latest-shell').props.pointerEvents
    ).toBe('auto');
  });

  it('scrolls and gives haptic feedback on press', () => {
    const { Feedback } = jest.requireMock('../utils/Feedback');
    const onPress = jest.fn();
    render(<ScrollToLatestButton visible onPress={onPress} />);

    fireEvent.press(screen.getByTestId('scroll-to-latest'));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Feedback.scrollToLatest).toHaveBeenCalledTimes(1);
  });
});
