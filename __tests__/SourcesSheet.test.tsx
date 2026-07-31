import React from 'react';
import type { ViewProps } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import type { SourceDocument } from '../database/chatRepository';

type BottomSheetModalHandle = {
  present: jest.Mock;
  dismiss: jest.Mock;
};

type BottomSheetModalMockProps = {
  children?: React.ReactNode;
};

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const MockReact = require('react') as typeof import('react');
  const { View } = require('react-native');

  const sheetPresentMock = jest.fn();
  const BottomSheetModal = MockReact.forwardRef<
    BottomSheetModalHandle,
    BottomSheetModalMockProps
  >(({ children }, ref) => {
    MockReact.useImperativeHandle(ref, () => ({
      present: sheetPresentMock,
      dismiss: jest.fn(),
    }));
    return <View testID="bottom-sheet-modal">{children}</View>;
  });

  return {
    __sheetPresentMock: sheetPresentMock,
    BottomSheetBackdrop: (props: ViewProps) => <View {...props} />,
    BottomSheetModal,
    BottomSheetView: View,
    BottomSheetScrollView: View,
    useBottomSheet: () => ({ close: jest.fn() }),
    useBottomSheetSpringConfigs: (config: unknown) => config,
  };
});

jest.mock('react-native-keyboard-controller', () => ({
  KeyboardEvents: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

const { __sheetPresentMock: mockSheetPresent } = jest.requireMock(
  '@gorhom/bottom-sheet'
) as { __sheetPresentMock: jest.Mock };

const { KeyboardEvents: mockKeyboardEvents } = jest.requireMock(
  'react-native-keyboard-controller'
) as { KeyboardEvents: { addListener: jest.Mock } };

import SourcesSheet, {
  type SourcesSheetHandle,
} from '../components/chat-screen/SourcesSheet';

beforeEach(() => {
  mockSheetPresent.mockClear();
  mockKeyboardEvents.addListener
    .mockClear()
    .mockImplementation(() => ({ remove: jest.fn() }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

const presentWith = (sources: SourceDocument[], userQuestion?: string) => {
  const ref = React.createRef<SourcesSheetHandle>();
  render(<SourcesSheet ref={ref} />);
  act(() => {
    ref.current?.present(sources, userQuestion);
  });
  return ref;
};

describe('SourcesSheet', () => {
  it('renders nothing until present() supplies sources', () => {
    render(<SourcesSheet ref={React.createRef<SourcesSheetHandle>()} />);

    expect(screen.queryByTestId('source-item')).toBeNull();
  });

  it('renders the sources handed to present()', () => {
    presentWith([{ documentId: 1, name: 'financial_report.pdf' }]);

    expect(screen.getByText('financial_report.pdf')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.queryByText('Source document')).toBeNull();
  });

  it('presents immediately when the keyboard is closed', () => {
    presentWith([{ documentId: 1, name: 'financial_report.pdf' }]);

    expect(mockSheetPresent).toHaveBeenCalledTimes(1);
  });

  it('closes the keyboard fully before presenting when it is open', () => {
    const { Keyboard } = require('react-native');
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    const dismissSpy = jest.spyOn(Keyboard, 'dismiss');
    let hideListener: (() => void) | undefined;
    mockKeyboardEvents.addListener.mockImplementation(
      (event: string, cb: () => void) => {
        if (event === 'keyboardDidHide') hideListener = cb;
        return { remove: jest.fn() };
      }
    );

    presentWith([{ documentId: 1, name: 'financial_report.pdf' }]);

    expect(dismissSpy).toHaveBeenCalled();
    expect(mockSheetPresent).not.toHaveBeenCalled();

    act(() => hideListener?.());

    expect(mockSheetPresent).toHaveBeenCalledTimes(1);
  });

  it('falls back to a timer when keyboardDidHide never fires', () => {
    jest.useFakeTimers();
    const { Keyboard } = require('react-native');
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);

    presentWith([{ documentId: 1, name: 'financial_report.pdf' }]);
    expect(mockSheetPresent).not.toHaveBeenCalled();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(mockSheetPresent).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('ignores a second present() while the sheet is still open', () => {
    const ref = presentWith([{ documentId: 1, name: 'first.pdf' }]);

    act(() => {
      ref.current?.present([{ documentId: 2, name: 'second.pdf' }]);
    });

    expect(screen.getByText('first.pdf')).toBeTruthy();
    expect(screen.queryByText('second.pdf')).toBeNull();
  });

  it('keeps the cited passage collapsed until the source row is tapped', () => {
    presentWith([
      {
        documentId: 1,
        name: 'financial_report.pdf',
        passage: 'Net revenue grew 12% year over year.',
      },
    ]);

    expect(screen.queryByTestId('source-passage')).toBeNull();

    fireEvent.press(screen.getByTestId('source-item'));

    expect(screen.getByTestId('source-passage')).toBeTruthy();
    expect(
      screen.getByText('Net revenue grew 12% year over year.')
    ).toBeTruthy();
  });

  it('emphasises the passage span relevant to the user question', () => {
    const passage =
      'Intro sentence. Net revenue grew 12% year over year. Outro.';
    presentWith(
      [{ documentId: 1, name: 'financial_report.pdf', passage }],
      'What was the net revenue growth?'
    );

    fireEvent.press(screen.getByTestId('source-item'));

    const cited = screen.getByText('Net revenue grew 12% year over year.');
    expect(cited).toBeTruthy();
    expect(cited.props.style).toEqual(
      expect.objectContaining({ fontFamily: expect.any(String) })
    );
  });

  it('does not render a passage block when the source has no passage', () => {
    presentWith([{ documentId: 1, name: 'financial_report.pdf' }]);

    fireEvent.press(screen.getByTestId('source-item'));

    expect(screen.queryByTestId('source-passage')).toBeNull();
  });
});
