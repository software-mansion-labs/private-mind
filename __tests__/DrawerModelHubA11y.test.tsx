import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DrawerItem } from '../components/drawer/DrawerItem';
import { DrawerTopBar } from '../components/drawer/DrawerTopBar';
import ModelHubTabs from '../components/model-hub/ModelHubTabs';
import FloatingActionButton from '../components/model-hub/FloatingActionButton';
import AttachmentThumbnail from '../components/chat-screen/AttachmentThumbnail';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('react-native-gesture-handler', () => {
  const RN = require('react-native');
  return { ScrollView: RN.ScrollView, Pressable: RN.Pressable };
});

jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('drawer row for a screen reader', () => {
  it('announces the current chat as a selected button', () => {
    render(<DrawerItem label="Trip plan" active onPress={jest.fn()} />);
    const row = screen.getByRole('button', { name: 'Trip plan' });
    expect(row.props.accessibilityState).toEqual({ selected: true });
  });

  it('announces another chat as an unselected button', () => {
    render(<DrawerItem label="Trip plan" active={false} onPress={jest.fn()} />);
    const row = screen.getByRole('button', { name: 'Trip plan' });
    expect(row.props.accessibilityState).toEqual({ selected: false });
  });

  it('offers a More options action that long-presses the chat', () => {
    const onLongPress = jest.fn();
    render(
      <DrawerItem
        label="Trip plan"
        active={false}
        onPress={jest.fn()}
        onLongPress={onLongPress}
      />
    );
    const row = screen.getByRole('button', { name: 'Trip plan' });
    expect(row.props.accessibilityActions).toEqual([
      { name: 'longpress', label: 'More options' },
    ]);
    fireEvent(row, 'accessibilityAction', {
      nativeEvent: { actionName: 'longpress' },
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('offers no More options action when the row has no menu', () => {
    render(<DrawerItem label="Models" active={false} onPress={jest.fn()} />);
    const row = screen.getByRole('button', { name: 'Models' });
    expect(row.props.accessibilityActions).toBeUndefined();
  });
});

describe('chat search field for a screen reader', () => {
  it('is read as Search chats', () => {
    render(
      <DrawerTopBar
        searching
        search=""
        onChangeSearch={jest.fn()}
        onCloseSearch={jest.fn()}
      />
    );
    expect(screen.getByLabelText('Search chats')).toBe(
      screen.getByTestId('drawer-search-input')
    );
  });
});

describe('model hub tabs for a screen reader', () => {
  it('announces the open tab as selected and the others as not', () => {
    render(<ModelHubTabs value="experimental" onChange={jest.fn()} />);
    expect(
      screen.UNSAFE_getByProps({ accessibilityRole: 'tablist' })
    ).toBeTruthy();
    expect(
      screen.getByRole('tab', { name: 'Experimental' }).props.accessibilityState
    ).toEqual({ selected: true });
    expect(
      screen.getByRole('tab', { name: 'Recommended' }).props.accessibilityState
    ).toEqual({ selected: false });
  });
});

describe('add model button for a screen reader', () => {
  it('is read as the Add model button', () => {
    render(<FloatingActionButton onPress={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Add model' })).toBeTruthy();
  });

  it('is announced as dimmed while disabled', () => {
    render(<FloatingActionButton onPress={jest.fn()} disabled />);
    expect(
      screen.getByRole('button', { name: 'Add model' }).props.accessibilityState
    ).toEqual({ disabled: true });
  });
});

describe('attachment loading for a screen reader', () => {
  it('reads the document load as a percentage', () => {
    render(
      <AttachmentThumbnail
        attachment={{
          id: 'a',
          type: 'document',
          uri: 'file:///a.pdf',
          status: 'loading',
          progress: 0.42,
        }}
        onRemove={jest.fn()}
      />
    );
    const bar = screen.getByRole('progressbar', { name: 'Loading attachment' });
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 42 });
  });
});
