import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockPresent = jest.fn();
const mockDismiss = jest.fn();

jest.mock('../components/bottomSheets/BackDismissibleSheetModal', () => {
  const { forwardRef, useImperativeHandle } = require('react');
  return {
    __esModule: true,
    default: forwardRef(
      ({ children }: { children: React.ReactNode }, ref: unknown) => {
        useImperativeHandle(ref, () => ({
          present: mockPresent,
          dismiss: mockDismiss,
        }));
        return children;
      }
    ),
  };
});

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: require('./helpers/renderWithTheme').testTheme }),
}));

jest.mock('../utils/Feedback', () => ({
  Feedback: { sheetOpen: jest.fn() },
}));

import PrivacySheet, {
  PRIVACY_SHEET_TITLE,
  PRIVACY_WEB_NOTE,
} from '../components/bottomSheets/PrivacySheet';
import OnDeviceNote from '../components/chat-screen/OnDeviceNote';
import OnDevicePill from '../components/chat-screen/OnDevicePill';
import {
  closedPrivacySheet,
  usePrivacySheetStore,
} from '../store/privacySheetStore';

const openPrivacySheet = () =>
  usePrivacySheetStore.getState().openPrivacySheet();

beforeEach(() => {
  jest.clearAllMocks();
  usePrivacySheetStore.setState({ openPrivacySheet: closedPrivacySheet });
});

describe('the privacy sheet', () => {
  it('stays closed until something asks for it', () => {
    render(<PrivacySheet />);

    expect(mockPresent).not.toHaveBeenCalled();
  });

  it('opens each time it is asked for', () => {
    render(<PrivacySheet />);

    act(() => openPrivacySheet());
    act(() => openPrivacySheet());

    expect(mockPresent).toHaveBeenCalledTimes(2);
  });

  it('stops answering once it is unmounted', () => {
    const { unmount } = render(<PrivacySheet />);
    unmount();

    openPrivacySheet();

    expect(mockPresent).not.toHaveBeenCalled();
  });

  it('explains what stays on the device and what goes online', () => {
    render(<PrivacySheet />);

    expect(screen.getByText(PRIVACY_SHEET_TITLE)).toBeTruthy();
    expect(screen.getByTestId('privacy-row-device')).toBeTruthy();
    expect(screen.getByTestId('privacy-row-offline')).toBeTruthy();
    expect(screen.getByTestId('privacy-row-stored')).toBeTruthy();
    expect(screen.getByText(PRIVACY_WEB_NOTE)).toBeTruthy();
  });

  it('closes with Got it', () => {
    render(<PrivacySheet />);

    fireEvent.press(screen.getByText('Got it'));

    expect(mockDismiss).toHaveBeenCalled();
  });
});

describe('asking for the privacy sheet', () => {
  const mockOpen = jest.fn();
  beforeEach(() =>
    usePrivacySheetStore.setState({ openPrivacySheet: mockOpen })
  );

  it('opens from the note at the top of a chat', () => {
    render(<OnDeviceNote />);

    fireEvent.press(screen.getByTestId('on-device-note'));

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });

  it('opens from the pill on the new chat screen', () => {
    render(<OnDevicePill />);

    fireEvent.press(screen.getByTestId('on-device-pill'));

    expect(mockOpen).toHaveBeenCalledTimes(1);
  });
});
