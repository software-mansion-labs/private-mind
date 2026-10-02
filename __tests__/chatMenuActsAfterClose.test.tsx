import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

let mockFinishDismiss: (() => void) | undefined;
const mockDismiss = jest.fn();

jest.mock('@gorhom/bottom-sheet', () => {
  const actual = jest.requireActual('../__mocks__/@gorhom/bottom-sheet');
  const { forwardRef, useImperativeHandle } = jest.requireActual('react');
  return {
    ...actual,
    BottomSheetModal: forwardRef(
      (
        {
          children,
          onDismiss,
        }: { children: React.ReactNode; onDismiss?: () => void },
        ref: React.Ref<{ present: () => void; dismiss: () => void }>
      ) => {
        mockFinishDismiss = onDismiss;
        useImperativeHandle(ref, () => ({
          present: jest.fn(),
          dismiss: mockDismiss,
        }));
        return <>{children}</>;
      }
    ),
  };
});

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

import ChatTitleMenuSheet from '../components/chat-screen/ChatTitleMenuSheet';

const renderMenu = (handlers: {
  onDelete?: () => void;
  onDismiss?: () => void;
}) =>
  render(
    <ChatTitleMenuSheet
      bottomSheetModalRef={React.createRef()}
      title="Trip plans"
      onRename={jest.fn()}
      onExport={jest.fn()}
      onDelete={handlers.onDelete ?? jest.fn()}
      onDismiss={handlers.onDismiss}
    />
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockFinishDismiss = undefined;
});

it('opens the delete confirmation only once the menu has closed, so the two sheets never stack (A-43)', () => {
  const onDelete = jest.fn();
  renderMenu({ onDelete });

  fireEvent.press(screen.getByText('Delete Chat'));

  expect(mockDismiss).toHaveBeenCalled();
  expect(onDelete).not.toHaveBeenCalled();

  mockFinishDismiss?.();

  expect(onDelete).toHaveBeenCalledTimes(1);
});

it('reports a plain close of the menu, without a chosen option', () => {
  const onDismiss = jest.fn();
  renderMenu({ onDismiss });

  mockFinishDismiss?.();

  expect(onDismiss).toHaveBeenCalledTimes(1);
});

it('leaves the menu lifecycle to the chosen option instead of also reporting a plain close', () => {
  const onDismiss = jest.fn();
  renderMenu({ onDismiss });

  fireEvent.press(screen.getByText('Delete Chat'));
  mockFinishDismiss?.();

  expect(onDismiss).not.toHaveBeenCalled();
});

it('ignores a second option tapped while the menu is still closing, so delete does not also open rename', () => {
  const onDelete = jest.fn();
  const onRename = jest.fn();
  render(
    <ChatTitleMenuSheet
      bottomSheetModalRef={React.createRef()}
      title="Trip plans"
      onRename={onRename}
      onExport={jest.fn()}
      onDelete={onDelete}
    />
  );

  fireEvent.press(screen.getByText('Delete Chat'));
  fireEvent.press(screen.getByText('Rename'));
  mockFinishDismiss?.();

  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onRename).not.toHaveBeenCalled();
});
