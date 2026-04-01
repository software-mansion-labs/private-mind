import React from 'react';
import { TouchableOpacity } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: { ...require('../styles/colors').lightTheme, insets: { top: 0, bottom: 0, left: 0, right: 0 } },
  }),
}));

jest.mock('../components/chat-screen/MarkdownComponent', () => {
  const { Text } = require('react-native');
  return ({ text }: any) => <Text testID="thinking-content">{text}</Text>;
});

import ThinkingBlock from '../components/chat-screen/ThinkingBlock';

const renderBlock = (props: Partial<React.ComponentProps<typeof ThinkingBlock>> = {}) =>
  render(<ThinkingBlock content="some reasoning" inProgress={false} {...props} />);

// ─── rendering ────────────────────────────────────────────────────────────────

describe('rendering', () => {
  it('always shows "Thinking..." title', () => {
    renderBlock();
    expect(screen.getByText('Thinking...')).toBeTruthy();
  });

  it('starts collapsed when block is complete (isComplete=true)', () => {
    renderBlock({ isComplete: true, inProgress: false });
    expect(screen.queryByTestId('thinking-content')).toBeNull();
  });

  it('starts expanded when block is incomplete (still streaming)', () => {
    renderBlock({ isComplete: false, inProgress: false });
    expect(screen.getByTestId('thinking-content')).toBeTruthy();
  });

  it('starts expanded when inProgress', () => {
    renderBlock({ isComplete: false, inProgress: true });
    expect(screen.getByTestId('thinking-content')).toBeTruthy();
  });
});

// ─── expand/collapse toggle ───────────────────────────────────────────────────

describe('expand/collapse', () => {
  it('expands a collapsed complete block when toggle is pressed', () => {
    renderBlock({ isComplete: true, inProgress: false });
    expect(screen.queryByTestId('thinking-content')).toBeNull();

    // The toggle button is the TouchableOpacity in the header
    const toggleBtn = screen.UNSAFE_getAllByType(TouchableOpacity)[0];
    fireEvent.press(toggleBtn);

    expect(screen.getByTestId('thinking-content')).toBeTruthy();
  });

  it('collapses an expanded incomplete block when toggle is pressed', () => {
    renderBlock({ isComplete: false, inProgress: false });
    expect(screen.getByTestId('thinking-content')).toBeTruthy();

    const toggleBtn = screen.UNSAFE_getAllByType(TouchableOpacity)[0];
    fireEvent.press(toggleBtn);

    expect(screen.queryByTestId('thinking-content')).toBeNull();
  });

  it('does not collapse when inProgress — toggle is a no-op', () => {
    renderBlock({ isComplete: false, inProgress: true });
    expect(screen.getByTestId('thinking-content')).toBeTruthy();

    const toggleBtn = screen.UNSAFE_getAllByType(TouchableOpacity)[0];
    fireEvent.press(toggleBtn);

    // Still visible — inProgress blocks the toggle
    expect(screen.getByTestId('thinking-content')).toBeTruthy();
  });
});

// ─── content ─────────────────────────────────────────────────────────────────

describe('content', () => {
  it('passes content string to MarkdownComponent when expanded', () => {
    renderBlock({ isComplete: false, content: 'deep reasoning here' });
    expect(screen.getByText('deep reasoning here')).toBeTruthy();
  });
});
