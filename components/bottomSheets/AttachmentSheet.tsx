import React, { type RefObject, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AppBottomSheet, type AppBottomSheetRef } from './AppBottomSheet';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import Toast from 'react-native-toast-message';
import CameraIcon from '../../assets/icons/camera.svg';
import ImageIcon from '../../assets/icons/image.svg';
import AttachmentIcon from '../../assets/icons/attachment.svg';
import { SvgComponent } from '../../utils/SvgComponent';
import { Feedback } from '../../utils/Feedback';

interface Props {
  bottomSheetModalRef: RefObject<AppBottomSheetRef | null>;
  isVisionModel: boolean;
  onPickFromLibrary: () => void;
  onPickFromCamera: () => void;
  onPickDocument: () => void;
  onSheetStateChange?: (isOpen: boolean) => void;
}

interface OptionProps {
  icon: SvgComponent;
  iconColor: string;
  label: string;
  onPress: () => void;
  testID: string;
  styles: ReturnType<typeof createStyles>;
  disabled?: boolean;
}

const AttachmentOption = ({
  icon: Icon,
  iconColor,
  label,
  onPress,
  testID,
  styles,
  disabled = false,
}: OptionProps) => (
  <TouchableOpacity
    style={[styles.option, disabled && styles.optionDisabled]}
    onPress={onPress}
    testID={testID}
  >
    <View style={styles.iconWrapper}>
      <Icon width={24} height={24} style={{ color: iconColor }} />
    </View>
    <Text style={styles.optionText}>{label}</Text>
  </TouchableOpacity>
);

const AttachmentSheet = ({
  bottomSheetModalRef,
  isVisionModel,
  onPickFromLibrary,
  onPickFromCamera,
  onPickDocument,
  onSheetStateChange,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const handleOption = (action: () => void) => {
    bottomSheetModalRef.current?.dismiss();
    action();
  };

  const handleImageOption = (action: () => void) => {
    if (!isVisionModel) {
      Toast.show({
        type: 'defaultToast',
        text1: 'This model does not support images',
      });
      return;
    }
    handleOption(action);
  };

  return (
    <AppBottomSheet
      ref={bottomSheetModalRef}
      dynamic
      handleColor={theme.border.soft}
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
        onSheetStateChange?.(index >= 0);
      }}
      onDismiss={() => {
        onSheetStateChange?.(false);
      }}
    >
      <View style={styles.container}>
        <AttachmentOption
          icon={CameraIcon}
          iconColor={theme.text.primary}
          label="Camera"
          onPress={() => handleImageOption(onPickFromCamera)}
          testID="attachment-camera"
          styles={styles}
          disabled={!isVisionModel}
        />
        <AttachmentOption
          icon={ImageIcon}
          iconColor={theme.text.primary}
          label="Photo Library"
          onPress={() => handleImageOption(onPickFromLibrary)}
          testID="attachment-library"
          styles={styles}
          disabled={!isVisionModel}
        />
        <AttachmentOption
          icon={AttachmentIcon}
          iconColor={theme.text.primary}
          label="Document"
          onPress={() => handleOption(onPickDocument)}
          testID="attachment-document"
          styles={styles}
        />
      </View>
    </AppBottomSheet>
  );
};

export default AttachmentSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 32,
      gap: 4,
    },
    option: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 8,
      gap: 16,
      borderRadius: 12,
    },
    optionDisabled: {
      opacity: 0.4,
    },
    iconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: theme.bg.softSecondary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    optionText: {
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
  });
