import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

let mockFinishDismiss: (() => void) | undefined;
const mockDismiss = jest.fn();
const mockSheetProps: Record<string, unknown>[] = [];

jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('../__mocks__/@gorhom/bottom-sheet');
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    ...actual,
    BottomSheetModal: forwardRef(
      (
        props: {
          children: React.ReactNode;
          onDismiss?: () => void;
        },
        ref: React.Ref<{ present: () => void; dismiss: () => void }>
      ) => {
        mockSheetProps.push(props);
        mockFinishDismiss = props.onDismiss;
        useImperativeHandle(ref, () => ({
          present: jest.fn(),
          dismiss: mockDismiss,
        }));
        return typeof props.children === 'function' ? null : (
          <>{props.children}</>
        );
      }
    ),
  };
});

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import ChatTitleMenuSheet from '../components/chat-screen/ChatTitleMenuSheet';
import WarningSheet from '../components/bottomSheets/WarningSheet';

const renderMenu = (
  handlers: {
    onDelete?: () => void;
    onRename?: () => void;
    onDismiss?: () => void;
  } = {}
) =>
  render(
    <ChatTitleMenuSheet
      bottomSheetModalRef={React.createRef()}
      title="Trip plans"
      onRename={handlers.onRename ?? jest.fn()}
      onExport={jest.fn()}
      onDelete={handlers.onDelete ?? jest.fn()}
      onDismiss={handlers.onDismiss}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockFinishDismiss = undefined;
  mockSheetProps.length = 0;
});

it('opens the delete confirmation at once, leaving no gap for a tap to reach the drawer below (A-101)', () => {
  const onDelete = jest.fn();
  renderMenu({ onDelete });

  fireEvent.press(screen.getByText('Delete Chat'));

  expect(mockDismiss).toHaveBeenCalled();
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it('ignores a second option tapped while the menu is still closing, so delete does not also open rename (W1)', () => {
  const onDelete = jest.fn();
  const onRename = jest.fn();
  renderMenu({ onDelete, onRename });

  fireEvent.press(screen.getByText('Delete Chat'));
  fireEvent.press(screen.getByText('Rename'));

  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onRename).not.toHaveBeenCalled();
});

it('takes an option again once the menu has closed and opened anew', () => {
  const onRename = jest.fn();
  renderMenu({ onRename });

  fireEvent.press(screen.getByText('Rename'));
  mockFinishDismiss?.();
  fireEvent.press(screen.getByText('Rename'));

  expect(onRename).toHaveBeenCalledTimes(2);
});

it('stacks the confirmation on top instead of minimizing the closing menu, so the menu is never restored behind it (A-43)', () => {
  render(<WarningSheet bottomSheetModalRef={React.createRef()} />);

  expect(mockSheetProps.at(-1)).toEqual(
    expect.objectContaining({ stackBehavior: 'push' })
  );
});
