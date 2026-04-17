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
import EditIcon from '../../assets/icons/edit.svg';
import UploadIcon from '../../assets/icons/upload.svg';
import TrashIcon from '../../assets/icons/trash.svg';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
}

const ChatTitleMenuSheet = ({
  bottomSheetModalRef,
  onRename,
  onExport,
  onDelete,
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
          onPress={() => handleOption(onRename)}
        >
          <View style={styles.iconWrapper}>
            <EditIcon
              width={24}
              height={24}
              style={{ color: theme.text.primary }}
            />
          </View>
          <Text style={styles.optionText}>Rename</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleOption(onExport)}
        >
          <View style={styles.iconWrapper}>
            <UploadIcon
              width={24}
              height={24}
              style={{ color: theme.text.primary }}
            />
          </View>
          <Text style={styles.optionText}>Export Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.option}
          onPress={() => handleOption(onDelete)}
        >
          <View style={styles.iconWrapper}>
            <TrashIcon
              width={24}
              height={24}
              style={{ color: theme.text.error }}
            />
          </View>
          <Text style={[styles.optionText, { color: theme.text.error }]}>
            Delete Chat
          </Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default ChatTitleMenuSheet;

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
