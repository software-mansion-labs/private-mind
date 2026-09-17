import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import CameraSheet from '../components/chat-screen/attachments/CameraSheet';
import { panelPalette } from '../components/chat-screen/attachments/constants';
import { lightTheme, type Theme } from '../styles/colors';

const mockTheme = {
  ...lightTheme,
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
} as Theme;

const mockPermission = { granted: false, canAskAgain: false };

jest.mock('expo-camera', () => ({
  CameraView: 'CameraView',
  useCameraPermissions: () => [mockPermission, jest.fn()],
}));

jest.mock('../context/ThemeContext', () => ({
  useTheme: () => ({ theme: mockTheme }),
}));

const renderSheet = () =>
  render(
    <CameraSheet
      width={300}
      height={400}
      facing="back"
      flash="off"
      preview={false}
      lifting={false}
    />
  );

describe('CameraSheet', () => {
  it('stands on the panel material while it has no preview, so the notice reads', () => {
    const tree = renderSheet().toJSON() as unknown as {
      props: { style: StyleProp<ViewStyle> };
    };
    const style = StyleSheet.flatten(tree.props.style);

    expect(style.backgroundColor).toBe(panelPalette(mockTheme).materialFlat);
    expect(style.backgroundColor).not.toBe(mockTheme.bg.lightbox);
  });

  it('says where the permission is turned back on', () => {
    const { getByText } = renderSheet();

    expect(
      getByText(
        'Camera access is off. Turn it on in Settings to take a photo here.'
      )
    ).toBeTruthy();
  });
});
