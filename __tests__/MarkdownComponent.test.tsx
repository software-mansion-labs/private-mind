import React from 'react';
import { render, screen } from '@testing-library/react-native';

const mounts: string[] = [];
const unmounts: string[] = [];

type MarkdownViewMockProps = {
  markdown: string;
  flavor?: 'commonmark' | 'github';
};

const markdownViewMock = (name: string) => {
  const MarkdownViewMock = ({ markdown, flavor }: MarkdownViewMockProps) => {
    const { useEffect } = require('react');
    const { Text } = require('react-native');
    useEffect(() => {
      mounts.push(name);
      return () => {
        unmounts.push(name);
      };
    }, []);
    return (
      <Text testID="markdown-view" accessibilityLabel={flavor ?? 'commonmark'}>
        {markdown}
      </Text>
    );
  };
  return MarkdownViewMock;
};

jest.mock('react-native-streamdown', () => ({
  StreamdownText: markdownViewMock('StreamdownText'),
}));

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: markdownViewMock('EnrichedMarkdownText'),
}));

import MarkdownComponent from '../components/chat-screen/MarkdownComponent';

beforeEach(() => {
  mounts.length = 0;
  unmounts.length = 0;
});

describe('MarkdownComponent across the end of a stream', () => {
  it('keeps the streamed markdown view mounted when the answer finishes', () => {
    const { rerender } = render(
      <MarkdownComponent text="- **Sleep** well" streaming />
    );

    rerender(<MarkdownComponent text="- **Sleep** well" streaming={false} />);

    expect(mounts).toEqual(['StreamdownText']);
    expect(unmounts).toEqual([]);
    expect(screen.getByTestId('markdown-view')).toHaveTextContent(
      '- **Sleep** well'
    );
  });

  it('renders the stream with the flavor the finished answer uses', () => {
    const { rerender } = render(<MarkdownComponent text="| a |" streaming />);
    const streamedFlavor =
      screen.getByTestId('markdown-view').props.accessibilityLabel;

    rerender(<MarkdownComponent text="| a |" streaming={false} />);

    expect(streamedFlavor).toBe('github');
    expect(screen.getByTestId('markdown-view').props.accessibilityLabel).toBe(
      'github'
    );
  });

  it('keeps the streamed view when streaming starts after the first render', () => {
    const { rerender } = render(
      <MarkdownComponent text="Hi" streaming={false} />
    );
    rerender(<MarkdownComponent text="Hi there" streaming />);
    mounts.length = 0;
    unmounts.length = 0;

    rerender(<MarkdownComponent text="Hi there." streaming={false} />);

    expect(mounts).toEqual([]);
    expect(unmounts).toEqual([]);
  });

  it('renders a message that never streamed straight to the static view', () => {
    render(<MarkdownComponent text="Saved answer" streaming={false} />);

    expect(mounts).toEqual(['EnrichedMarkdownText']);
    expect(screen.getByTestId('markdown-view').props.accessibilityLabel).toBe(
      'github'
    );
  });
});
