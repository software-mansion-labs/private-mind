import React, { RefObject, useMemo } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import CameraIcon from '../../assets/icons/camera.svg';
import ImageIcon from '../../assets/icons/image.svg';
import AttachmentIcon from '../../assets/icons/attachment.svg';
import { SvgComponent } from '../../utils/SvgComponent';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
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
}

const AttachmentOption = ({
  icon: Icon,
  iconColor,
  label,
  onPress,
  testID,
  styles,
}: OptionProps) => (
  <TouchableOpacity style={styles.option} onPress={onPress} testID={testID}>
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

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      enableDynamicSizing
      onChange={(index) => onSheetStateChange?.(index >= 0)}
      onDismiss={() => onSheetStateChange?.(false)}
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
        />
      )}
      backgroundStyle={{ backgroundColor: theme.bg.softPrimary }}
      handleIndicatorStyle={{ backgroundColor: theme.border.soft }}
    >
      <BottomSheetView style={styles.container}>
        {isVisionModel && (
          <>
            <AttachmentOption
              icon={CameraIcon}
              iconColor={theme.text.primary}
              label="Camera"
              onPress={() => handleOption(onPickFromCamera)}
              testID="attachment-camera"
              styles={styles}
            />
            <AttachmentOption
              icon={ImageIcon}
              iconColor={theme.text.primary}
              label="Photo Library"
              onPress={() => handleOption(onPickFromLibrary)}
              testID="attachment-library"
              styles={styles}
            />
          </>
        )}
        <AttachmentOption
          icon={AttachmentIcon}
          iconColor={theme.text.primary}
          label="Document"
          onPress={() => handleOption(onPickDocument)}
          testID="attachment-document"
          styles={styles}
        />
      </BottomSheetView>
    </BottomSheetModal>
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
