import React, { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import type { BottomSheetModal } from '@gorhom/bottom-sheet';

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      ...require('../styles/colors').lightTheme,
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    },
  }),
}));

import AttachmentSheet from '../components/bottomSheets/AttachmentSheet';
import Toast from 'react-native-toast-message';

const makeProps = (isVisionModel: boolean) => ({
  bottomSheetModalRef: createRef<BottomSheetModal>(),
  isVisionModel,
  onPickFromLibrary: jest.fn(),
  onPickFromCamera: jest.fn(),
  onPickDocument: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

describe('AttachmentSheet', () => {
  it('always renders Camera, Photo Library and Document options for a vision model', () => {
    render(<AttachmentSheet {...makeProps(true)} />);
    expect(screen.getByTestId('attachment-camera')).toBeTruthy();
    expect(screen.getByTestId('attachment-library')).toBeTruthy();
    expect(screen.getByTestId('attachment-document')).toBeTruthy();
  });

  it('still renders the image options (greyed) for a non-vision model', () => {
    render(<AttachmentSheet {...makeProps(false)} />);
    expect(screen.getByTestId('attachment-camera')).toBeTruthy();
    expect(screen.getByTestId('attachment-library')).toBeTruthy();
    expect(screen.getByTestId('attachment-document')).toBeTruthy();
  });

  describe('vision model', () => {
    it('invokes the camera picker when Camera is pressed', () => {
      const props = makeProps(true);
      render(<AttachmentSheet {...props} />);
      fireEvent.press(screen.getByTestId('attachment-camera'));
      expect(props.onPickFromCamera).toHaveBeenCalledTimes(1);
      expect(Toast.show).not.toHaveBeenCalled();
    });

    it('invokes the library picker when Photo Library is pressed', () => {
      const props = makeProps(true);
      render(<AttachmentSheet {...props} />);
      fireEvent.press(screen.getByTestId('attachment-library'));
      expect(props.onPickFromLibrary).toHaveBeenCalledTimes(1);
      expect(Toast.show).not.toHaveBeenCalled();
    });
  });

  describe('non-vision model', () => {
    it('shows an explanatory toast and does not open the camera picker', () => {
      const props = makeProps(false);
      render(<AttachmentSheet {...props} />);
      fireEvent.press(screen.getByTestId('attachment-camera'));
      expect(props.onPickFromCamera).not.toHaveBeenCalled();
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text1: 'This model does not support images',
        })
      );
    });

    it('shows an explanatory toast and does not open the library picker', () => {
      const props = makeProps(false);
      render(<AttachmentSheet {...props} />);
      fireEvent.press(screen.getByTestId('attachment-library'));
      expect(props.onPickFromLibrary).not.toHaveBeenCalled();
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          text1: 'This model does not support images',
        })
      );
    });

    it('still allows attaching a document without a toast', () => {
      const props = makeProps(false);
      render(<AttachmentSheet {...props} />);
      fireEvent.press(screen.getByTestId('attachment-document'));
      expect(props.onPickDocument).toHaveBeenCalledTimes(1);
      expect(Toast.show).not.toHaveBeenCalled();
    });
  });
});
