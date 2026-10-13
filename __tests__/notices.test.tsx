import React, { useEffect } from 'react';
import { Text } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import NoticeHost from '../components/notices/NoticeHost';
import {
  bySeverity,
  useNoticeStore,
  type AppNotice,
} from '../store/noticeStore';

const warning: AppNotice = {
  id: 'cpu',
  variant: 'warning',
  title: 'Not supported',
  message: 'Models cannot run here.',
};
const info: AppNotice = { id: 'tip', variant: 'info', title: 'A tip' };
const error: AppNotice = { id: 'broken', variant: 'error', title: 'Broken' };

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

  it('removes only the dismissed notice', () => {
    const { showNotice, dismissNotice } = useNoticeStore.getState();
    showNotice(warning);
    showNotice(info);
    dismissNotice('cpu');

    expect(useNoticeStore.getState().notices).toEqual([info]);
  });

  it('puts errors first, then warnings, then information', () => {
    expect(bySeverity([info, warning, error]).map((n) => n.id)).toEqual([
      'broken',
      'cpu',
      'tip',
    ]);
  });
});

describe('NoticeHost', () => {
  it('shows the app alone when there is nothing to tell', () => {
    render(
      <NoticeHost>
        <Text>app content</Text>
      </NoticeHost>
    );

    expect(screen.getByText('app content')).toBeTruthy();
    expect(screen.queryByTestId('notice-stack')).toBeNull();
  });

  it('shows a notice above the app with its title and message', () => {
    useNoticeStore.getState().showNotice(warning);
    render(
      <NoticeHost>
        <Text>app content</Text>
      </NoticeHost>
    );

    expect(screen.getByText('Not supported')).toBeTruthy();
    expect(screen.getByText('Models cannot run here.')).toBeTruthy();
    expect(screen.getByText('app content')).toBeTruthy();
  });

  it('offers no way to close a notice that is not dismissible', () => {
    useNoticeStore.getState().showNotice(warning);
    render(
      <NoticeHost>
        <Text>app content</Text>
      </NoticeHost>
    );

    expect(screen.queryByTestId('notice-cpu-dismiss')).toBeNull();
  });

  it('closes a dismissible notice and runs its action', () => {
    const onPress = jest.fn();
    useNoticeStore.getState().showNotice({
      ...info,
      dismissible: true,
      action: { label: 'Learn more', onPress },
    });
    render(
      <NoticeHost>
        <Text>app content</Text>
      </NoticeHost>
    );

    fireEvent.press(screen.getByText('Learn more'));
    expect(onPress).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getByTestId('notice-tip-dismiss'));
    expect(screen.queryByText('A tip')).toBeNull();
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
      <NoticeHost>
        <App />
      </NoticeHost>
    );

    act(() => useNoticeStore.getState().showNotice(warning));

    expect(screen.getByText('Not supported')).toBeTruthy();
    expect(mounts).toHaveBeenCalledTimes(1);
  });
});
