import React from 'react';
import { render, act } from '@testing-library/react-native';
import { type WebSearchTraceEntry } from '../store/webSearchStore';
import { type SourceDocument } from '../database/chatRepository';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

const mockTraceListMounts = { count: 0 };

jest.mock('../components/chat-screen/WebSearchTraceList', () => {
  const { createElement, useEffect } = require('react');
  const { View } = require('react-native');
  return function TraceListMock() {
    useEffect(() => {
      mockTraceListMounts.count += 1;
    }, []);
    return createElement(View, { testID: 'trace-list' });
  };
});

import WebSearchBlock from '../components/chat-screen/WebSearchBlock';
import { useWebSearchStore } from '../store/webSearchStore';

const ev = (over: Partial<WebSearchTraceEntry>): WebSearchTraceEntry => ({
  id: 0,
  type: 'searching',
  ...over,
});

const src = (over: Partial<SourceDocument> = {}): SourceDocument => ({
  name: 'Result',
  ...over,
});

const liveTrace: WebSearchTraceEntry[] = [
  ev({ id: 1, type: 'objectives' }),
  ev({ id: 2, type: 'searching', query: 'population of Warsaw' }),
  ev({
    id: 3,
    type: 'found',
    url: 'https://en.wikipedia.org/wiki/Warsaw',
    host: 'en.wikipedia.org',
  }),
  ev({ id: 4, type: 'reading' }),
];

const savedResults: SourceDocument[] = [
  src({
    name: 'Warsaw',
    url: 'https://en.wikipedia.org/wiki/Warsaw',
    sourceQuery: 'population of Warsaw',
    read: true,
    used: true,
  }),
];

const renderLive = () =>
  render(<WebSearchBlock isSearching trace={liveTrace} results={[]} />);

const expandTrace = () =>
  act(() => {
    useWebSearchStore.getState().setTraceExpanded(true);
  });

describe('the hand-over from the live trace to the saved sources', () => {
  beforeEach(() => {
    mockTraceListMounts.count = 0;
    act(() => {
      useWebSearchStore.setState({
        webSearchTrace: [],
        traceExpanded: false,
        challengeActive: false,
      });
    });
  });

  it('keeps the same trace list mounted when the turn finishes', () => {
    const view = renderLive();
    expandTrace();

    const mountsWhileLive = mockTraceListMounts.count;
    expect(mountsWhileLive).toBeGreaterThan(0);

    view.rerender(
      <WebSearchBlock isSearching={false} trace={[]} results={savedResults} />
    );

    expect(mockTraceListMounts.count).toBe(mountsWhileLive);
  });

  it('still shows the trace after the hand-over', () => {
    const view = renderLive();
    expandTrace();

    view.rerender(
      <WebSearchBlock isSearching={false} trace={[]} results={savedResults} />
    );

    expect(view.getByTestId('trace-list')).toBeTruthy();
  });
});
