import React, { type ReactNode } from 'react';
import { Alert, Platform, Pressable, Text } from 'react-native';
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react-native';
import type { AppBottomSheetRef } from '../components/bottomSheets/AppBottomSheet';
import type { WarningSheetData } from '../components/bottomSheets/WarningSheet';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

type MockSheetProps = {
  onDismiss?: () => void;
  children: ReactNode | ((state: { data?: WarningSheetData }) => ReactNode);
};

jest.mock('../components/bottomSheets/AppBottomSheet', () => {
  const ReactModule: typeof React = require('react');
  const { View } = require('react-native');

  const AppBottomSheet = ReactModule.forwardRef<
    AppBottomSheetRef<WarningSheetData>,
    MockSheetProps
  >((props, ref) => {
    const [state, setState] = ReactModule.useState<{
      data?: WarningSheetData;
    } | null>(null);

    const close = () => {
      setState(null);
      props.onDismiss?.();
    };

    ReactModule.useImperativeHandle(ref, () => ({
      present: (data?: WarningSheetData) => setState({ data }),
      dismiss: close,
      close,
    }));

    if (!state) return null;
    return (
      <View>
        {typeof props.children === 'function'
          ? props.children(state)
          : props.children}
      </View>
    );
  });

  return { AppBottomSheet };
});

import { useConfirm } from '../hooks/useConfirm';

const setPlatform = (os: string) => {
  Object.defineProperty(Platform, 'OS', { get: () => os, configurable: true });
};

const ORIGINAL_OS = Platform.OS;

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

const HarnessNoSheet = () => {
  const { confirm } = useConfirm();
  return (
    <Pressable
      testID="ask"
      onPress={async () => onResult(await confirm(OPTIONS))}
    >
      <Text>Ask</Text>
    </Pressable>
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

afterEach(() => setPlatform(ORIGINAL_OS));

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

  it('resolves false instead of hanging when no sheet is mounted', async () => {
    render(<HarnessNoSheet />);

    fireEvent.press(screen.getByTestId('ask'));

    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false));
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
