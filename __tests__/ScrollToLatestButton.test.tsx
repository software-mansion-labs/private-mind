import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ScrollToLatestButton from '../components/chat-screen/ScrollToLatestButton';

jest.mock('../utils/Feedback', () => ({
  Feedback: { scrollToLatest: jest.fn() },
}));

const hiddenShell = () =>
  screen.getByTestId('scroll-to-latest-shell', { includeHiddenElements: true });

describe('ScrollToLatestButton', () => {
  it('stays mounted while hidden so it can animate out', () => {
    render(<ScrollToLatestButton visible={false} onPress={jest.fn()} />);

    expect(
      screen.getByTestId('scroll-to-latest', { includeHiddenElements: true })
    ).toBeTruthy();
  });

  it('takes no touches while hidden', () => {
    render(<ScrollToLatestButton visible={false} onPress={jest.fn()} />);

    expect(hiddenShell().props.pointerEvents).toBe('none');
  });

  it('is not announced while it is hidden', () => {
    render(<ScrollToLatestButton visible={false} onPress={jest.fn()} />);

    const shell = hiddenShell();
    expect(shell.props.accessibilityElementsHidden).toBe(true);
    expect(shell.props.importantForAccessibility).toBe('no-hide-descendants');
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
