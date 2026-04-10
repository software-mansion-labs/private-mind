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

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  isVisionModel: boolean;
  onPickFromLibrary: () => void;
  onPickFromCamera: () => void;
  onPickDocument: () => void;
  onSheetStateChange?: (isOpen: boolean) => void;
}

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
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOption(onPickFromCamera)}
              testID="attachment-camera"
            >
              <View style={styles.iconWrapper}>
                <CameraIcon
                  width={24}
                  height={24}
                  style={{ color: theme.text.primary }}
                />
              </View>
              <Text style={styles.optionText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.option}
              onPress={() => handleOption(onPickFromLibrary)}
              testID="attachment-library"
            >
              <View style={styles.iconWrapper}>
                <ImageIcon
                  width={24}
                  height={24}
                  style={{ color: theme.text.primary }}
                />
              </View>
              <Text style={styles.optionText}>Photo Library</Text>
            </TouchableOpacity>
          </>
        )}
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleOption(onPickDocument)}
          testID="attachment-document"
        >
          <View style={styles.iconWrapper}>
            <AttachmentIcon
              width={24}
              height={24}
              style={{ color: theme.text.primary }}
            />
          </View>
          <Text style={styles.optionText}>Document</Text>
        </TouchableOpacity>
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
