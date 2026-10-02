import React from 'react';
import { render } from '@testing-library/react-native';
import { darkTheme } from '../styles/colors';
import MarkdownComponent from '../components/chat-screen/MarkdownComponent';

const renderedStyles: Record<string, unknown>[] = [];

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: (props: { markdownStyle: Record<string, unknown> }) => {
    renderedStyles.push(props.markdownStyle);
    return null;
  },
}));

jest.mock('react-native-streamdown', () => ({
  StreamdownText: (props: { markdownStyle: Record<string, unknown> }) => {
    renderedStyles.push(props.markdownStyle);
    return null;
  },
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('../styles/colors').darkTheme }),
}));

const TABLE = '| a | b |\n| - | - |\n| 1 | 2 |';

describe('MarkdownComponent tables', () => {
  beforeEach(() => {
    renderedStyles.length = 0;
  });

  it.each([
    ['a finished answer', false],
    ['a streaming answer', true],
  ])('colours the table of %s from the dark theme', (_, streaming) => {
    render(<MarkdownComponent text={TABLE} streaming={streaming} />);

    expect(renderedStyles.at(-1)?.table).toEqual(
      expect.objectContaining({
        color: darkTheme.text.primary,
        headerTextColor: darkTheme.text.primary,
        headerBackgroundColor: darkTheme.bg.codeBlock,
        rowEvenBackgroundColor: 'transparent',
        rowOddBackgroundColor: 'transparent',
        borderColor: darkTheme.border.soft,
      })
    );
  });
});
