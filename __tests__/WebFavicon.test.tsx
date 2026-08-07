import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

import WebFavicon from '../components/chat-screen/WebFavicon';

beforeEach(() => {
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

const failOnce = () => {
  fireEvent(screen.getByTestId('web-favicon'), 'error');
};

describe('WebFavicon — a failed load is retried, not final', () => {
  it('requests the icon again after an error, with a cache-busting uri', () => {
    render(<WebFavicon url="https://a.example/page" size={16} />);
    const first = screen.getByTestId('web-favicon').props.source.uri;

    failOnce();
    act(() => {
      jest.advanceTimersByTime(2000);
    });

    const retried = screen.getByTestId('web-favicon').props.source.uri;
    expect(retried).not.toBe(first);
    expect(retried).toContain('retry=1');
  });

  it('waits out the backoff before retrying', () => {
    render(<WebFavicon url="https://a.example/page" size={16} />);

    failOnce();
    act(() => {
      jest.advanceTimersByTime(1999);
    });
    expect(screen.getByTestId('web-favicon').props.source.uri).not.toContain(
      'retry'
    );
  });

  it('gives up for good only after the retry budget is spent', () => {
    render(<WebFavicon url="https://a.example/page" size={16} />);

    failOnce();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    failOnce();
    act(() => {
      jest.advanceTimersByTime(6000);
    });
    expect(screen.getByTestId('web-favicon').props.source.uri).toContain(
      'retry=2'
    );

    failOnce();
    act(() => {
      jest.advanceTimersByTime(60000);
    });
    expect(screen.queryByTestId('web-favicon')).toBeNull();
  });

  it('starts over with a clean slate when the url changes', () => {
    const view = render(<WebFavicon url="https://a.example/page" size={16} />);
    failOnce();
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByTestId('web-favicon').props.source.uri).toContain(
      'retry=1'
    );

    view.rerender(<WebFavicon url="https://b.example/page" size={16} />);
    const fresh = screen.getByTestId('web-favicon').props.source.uri;
    expect(fresh).toContain('b.example');
    expect(fresh).not.toContain('retry');
  });
});
