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

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onPickFromLibrary: () => void;
  onPickFromCamera: () => void;
}

const ImageSourceSheet = ({
  bottomSheetModalRef,
  onPickFromLibrary,
  onPickFromCamera,
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
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleOption(onPickFromCamera)}
        >
          <View style={styles.iconWrapper}>
            <CameraIcon width={24} height={24} style={{ color: theme.text.primary }} />
          </View>
          <Text style={styles.optionText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleOption(onPickFromLibrary)}
        >
          <View style={styles.iconWrapper}>
            <ImageIcon width={24} height={24} style={{ color: theme.text.primary }} />
          </View>
          <Text style={styles.optionText}>Photo Library</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default ImageSourceSheet;

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
