import React from 'react';
import { render } from '@testing-library/react-native';

const mockHost = jest.fn();
jest.mock('../hooks/useScrapeHost', () => ({
  useScrapeHost: () => mockHost(),
}));
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return {
    WebView: (props: object) => <View testID="scrape-webview" {...props} />,
  };
});
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('../hooks/useThemedStyles', () => ({
  useThemedStyles: () => ({
    styles: new Proxy({}, { get: () => ({}) }),
    theme: { bg: { softPrimary: '#fff', main: '#fff' }, insets: { top: 0 } },
  }),
}));

import WebScrapeSheet from '../components/bottomSheets/WebScrapeSheet';

const host = (nav: { uri: string; key: number; nonce: number } | null) => ({
  webRef: { current: null },
  nav,
  onLoadScript: undefined,
  revealed: false,
  closeAndCancel: jest.fn(),
  recheck: jest.fn(),
  handleMessage: jest.fn(),
  handleLoadEnd: jest.fn(),
  handleNavigationStateChange: jest.fn(),
});

describe('WebScrapeSheet', () => {
  it('creates no web view until a search needs one', () => {
    mockHost.mockReturnValue(host(null));

    const { queryByTestId } = render(<WebScrapeSheet />);

    expect(queryByTestId('scrape-webview')).toBeNull();
  });

  it('loads the page of the current navigation', () => {
    mockHost.mockReturnValue(
      host({ uri: 'https://example.com/?q=a', key: 3, nonce: 1 })
    );

    const { getByTestId } = render(<WebScrapeSheet />);

    expect(getByTestId('scrape-webview').props.source).toEqual({
      uri: 'https://example.com/?q=a',
    });
  });
});
