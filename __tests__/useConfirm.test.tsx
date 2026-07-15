import React from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');

  const BottomSheetModal = ReactModule.forwardRef((props: any, ref: any) => {
    const [data, setData] = ReactModule.useState(null);

    ReactModule.useImperativeHandle(ref, () => ({
      present: (presented: any) => setData(presented ?? {}),
      dismiss: () => {
        setData(null);
        props.onDismiss?.();
      },
    }));

    if (!data) return null;
    return (
      <View>
        {typeof props.children === 'function'
          ? props.children({ data })
          : props.children}
      </View>
    );
  });

  return {
    BottomSheetModal,
    BottomSheetView: ({ children, style }: any) => (
      <View style={style}>{children}</View>
    ),
    BottomSheetBackdrop: () => null,
    BottomSheetModalProvider: ({ children }: any) => <>{children}</>,
  };
});

import { useConfirm } from '../hooks/useConfirm';

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

const OPTIONS = {
  title: 'Delete Chat',
  message: 'Are you sure you want to delete this chat?',
  confirmLabel: 'Delete',
};

const onResult = jest.fn();

const Harness = () => {
  const { confirm, ConfirmElement } = useConfirm();
  return (
    <>
      <Pressable
        testID="ask"
        onPress={async () => onResult(await confirm(OPTIONS))}
      >
        <Text>Ask</Text>
      </Pressable>
      {ConfirmElement}
    </>
  );
};

const getIosButton = (spy: jest.SpyInstance, text: string) => {
  const buttons = spy.mock.calls[0][2] as {
    text: string;
    onPress: () => void;
  }[];
  return buttons.find((button) => button.text === text)!;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useConfirm — Android', () => {
  beforeEach(() => setPlatform('android'));

  it('shows nothing until a confirmation is requested', () => {
    render(<Harness />);

    expect(screen.queryByText('Delete Chat')).toBeNull();
  });

  it('presents the sheet with the requested copy', () => {
    render(<Harness />);

    fireEvent.press(screen.getByTestId('ask'));

    expect(screen.getByText('Delete Chat')).toBeTruthy();
    expect(
      screen.getByText('Are you sure you want to delete this chat?')
    ).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('resolves true when the destructive button is pressed', async () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('ask'));

    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('resolves false when cancelled', async () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('ask'));

    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });

  it('closes the sheet once a choice is made', async () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('ask'));

    fireEvent.press(screen.getByText('Delete'));

    await waitFor(() => expect(screen.queryByText('Delete Chat')).toBeNull());
  });

  it('settles a pending confirmation as cancelled when a new one is requested', async () => {
    render(<Harness />);
    fireEvent.press(screen.getByTestId('ask'));

    fireEvent.press(screen.getByTestId('ask'));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
    expect(screen.getByText('Delete Chat')).toBeTruthy();
  });

  it('does not use the native alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness />);

    fireEvent.press(screen.getByTestId('ask'));

    expect(alertSpy).not.toHaveBeenCalled();
  });
});

describe('useConfirm — iOS', () => {
  beforeEach(() => setPlatform('ios'));

  it('uses the native alert and mounts no sheet', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness />);

    fireEvent.press(screen.getByTestId('ask'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Chat',
      'Are you sure you want to delete this chat?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel', style: 'cancel' }),
        expect.objectContaining({ text: 'Delete', style: 'destructive' }),
      ])
    );
    expect(
      screen.queryByText('Are you sure you want to delete this chat?')
    ).toBeNull();
  });

  it('resolves true when the destructive button is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness />);
    fireEvent.press(screen.getByTestId('ask'));

    getIosButton(alertSpy, 'Delete').onPress();

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true));
  });

  it('resolves false when cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<Harness />);
    fireEvent.press(screen.getByTestId('ask'));

    getIosButton(alertSpy, 'Cancel').onPress();

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
  });
});
