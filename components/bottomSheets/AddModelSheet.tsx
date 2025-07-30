import React, { RefObject, useCallback, useMemo } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { router } from 'expo-router';
import EntryButton from '../EntryButton';
import LinkAltIcon from '../../assets/icons/link-alt.svg';
import FolderIcon from '../../assets/icons/folder.svg';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

const AddModelSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={1}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicatorStyle}
      backgroundStyle={styles.sheetBackground}
    >
      <BottomSheetView style={styles.sheetContent}>
        <Text style={styles.title}>Add model</Text>
        <View style={styles.buttonGroup}>
          <EntryButton
            icon={<LinkAltIcon width={22} height={22} style={styles.icon} />}
            text="From external URLs"
            onPress={() => {
              router.push('/modal/add-remote-model');
              bottomSheetModalRef.current?.close();
            }}
          />
          <EntryButton
            icon={<FolderIcon width={20} height={17} style={styles.icon} />}
            text="From local files"
            onPress={() => {
              router.push('/modal/add-local-model');
              bottomSheetModalRef.current?.close();
            }}
          />
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default AddModelSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetContent: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      paddingBottom: theme.insets.bottom + 16,
      gap: 24,
      backgroundColor: theme.bg.softPrimary,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    buttonGroup: {
      gap: 8,
    },
    icon: {
      color: theme.text.primary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    handleStyle: {
      backgroundColor: theme.bg.softPrimary,
      borderRadius: 16,
    },
    handleIndicatorStyle: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    sheetBackground: {
      backgroundColor: theme.bg.softPrimary,
    },
  });
