import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme },
  }),
}));

import ChatTitle from '../components/chat-screen/ChatTitle';

const TITLE = 'What are the latest space exploration news?';
const MAX_WIDTH = 266;
const ELLIPSIS_WIDTH = 13;
const HIDDEN = { includeHiddenElements: true };

const lines = (...texts: string[]) => ({
  nativeEvent: { lines: texts.map((text) => ({ text })) },
});

const renderMeasured = () => {
  const screen = render(
    <ChatTitle title={TITLE} onPress={jest.fn()} maxWidth={MAX_WIDTH} />
  );
  act(() => {
    fireEvent(screen.getByTestId('chat-title-ellipsis', HIDDEN), 'layout', {
      nativeEvent: { layout: { width: ELLIPSIS_WIDTH } },
    });
  });
  return screen;
};

describe('ChatTitle', () => {
  it('looks for the cut in the width left beside the ellipsis', () => {
    const { getByTestId } = renderMeasured();

    const wholeWidth = getByTestId('chat-title-whole', HIDDEN).props.style[1]
      .width;

    expect(getByTestId('chat-title-cut', HIDDEN).props.style).toContainEqual({
      width: wholeWidth - ELLIPSIS_WIDTH,
    });
  });

  it('drops a last word that fits only without the ellipsis', () => {
    const { getByTestId, getByText } = renderMeasured();

    act(() => {
      fireEvent(
        getByTestId('chat-title-whole', HIDDEN),
        'textLayout',
        lines('What are the latest space ', 'exploration news?')
      );
      fireEvent(
        getByTestId('chat-title-cut', HIDDEN),
        'textLayout',
        lines('What are the latest ', 'space exploration news?')
      );
    });

    expect(getByText('What are the latest\u2026')).toBeTruthy();
  });

  it('keeps a title whole when it fits, however it wraps beside the ellipsis', () => {
    const { getByTestId, getByText } = renderMeasured();

    act(() => {
      fireEvent(
        getByTestId('chat-title-whole', HIDDEN),
        'textLayout',
        lines(TITLE)
      );
      fireEvent(
        getByTestId('chat-title-cut', HIDDEN),
        'textLayout',
        lines('What are the latest space exploration ', 'news?')
      );
    });

    expect(getByText(TITLE)).toBeTruthy();
  });

  it('shows a lock beside the title', () => {
    const { getByTestId } = render(<ChatTitle title="Lisbon weekend" />);

    expect(getByTestId('chat-title-lock')).toBeTruthy();
  });

  it('tells screen readers the chat runs on this device', () => {
    const { getByRole } = render(
      <ChatTitle title="Lisbon weekend" onPress={jest.fn()} />
    );

    expect(getByRole('button').props.accessibilityLabel).toBe(
      'Lisbon weekend. Private, runs on this device. Chat options'
    );
  });
});
