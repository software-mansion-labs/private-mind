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
import { SvgComponent } from '../../utils/SvgComponent';
import { Feedback } from '../../utils/Feedback';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onRename: () => void;
  onExport: () => void;
  onDelete: () => void;
}

interface OptionProps {
  icon: SvgComponent;
  iconColor: string;
  label: string;
  labelColor?: string;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
}

const MenuOption = ({
  icon: Icon,
  iconColor,
  label,
  labelColor,
  onPress,
  styles,
}: OptionProps) => (
  <TouchableOpacity style={styles.option} onPress={onPress}>
    <View style={styles.iconWrapper}>
      <Icon width={24} height={24} style={{ color: iconColor }} />
    </View>
    <Text
      style={[styles.optionText, labelColor ? { color: labelColor } : null]}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

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
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
      }}
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
        <MenuOption
          icon={EditIcon}
          iconColor={theme.text.primary}
          label="Rename"
          onPress={() => handleOption(onRename)}
          styles={styles}
        />
        <MenuOption
          icon={UploadIcon}
          iconColor={theme.text.primary}
          label="Export Chat"
          onPress={() => handleOption(onExport)}
          styles={styles}
        />
        <MenuOption
          icon={TrashIcon}
          iconColor={theme.text.error}
          label="Delete Chat"
          labelColor={theme.text.error}
          onPress={() => {
            Feedback.destructive();
            handleOption(onDelete);
          }}
          styles={styles}
        />
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
