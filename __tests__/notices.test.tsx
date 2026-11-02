import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import AppNotices from '../components/notices/AppNotices';
import { useNoticeStore, type AppNotice } from '../store/noticeStore';

const warning: AppNotice = {
  id: 'cpu',
  title: 'Not supported',
  message: 'Models cannot run here.',
};

afterEach(() => {
  act(() => useNoticeStore.setState({ notices: [] }));
});

describe('noticeStore', () => {
  it('replaces a notice shown again under the same id instead of stacking it', () => {
    const { showNotice } = useNoticeStore.getState();
    showNotice(warning);
    showNotice({ ...warning, title: 'Still not supported' });

    expect(useNoticeStore.getState().notices).toEqual([
      { ...warning, title: 'Still not supported' },
    ]);
  });
});

describe('AppNotices', () => {
  it('shows the app alone when there is nothing to tell', () => {
    render(
      <AppNotices>
        <Text>app content</Text>
      </AppNotices>
    );

    expect(screen.getByText('app content')).toBeTruthy();
    expect(screen.queryByTestId('notice-stack')).toBeNull();
  });

  it('shows a notice above the app with its title and message', () => {
    useNoticeStore.getState().showNotice(warning);
    render(
      <AppNotices>
        <Text>app content</Text>
      </AppNotices>
    );

    expect(screen.getByText('Not supported')).toBeTruthy();
    expect(screen.getByText('Models cannot run here.')).toBeTruthy();
    expect(screen.getByText('app content')).toBeTruthy();
  });

  it('keeps the app mounted when a notice appears, so navigation state survives', () => {
    const mounts = jest.fn();
    const App = () => {
      useEffect(() => {
        mounts();
      }, []);
      return <Text>app content</Text>;
    };
    render(
      <AppNotices>
        <App />
      </AppNotices>
    );

    act(() => useNoticeStore.getState().showNotice(warning));

    expect(screen.getByText('Not supported')).toBeTruthy();
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});
