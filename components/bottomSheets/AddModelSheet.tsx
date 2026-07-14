import React, { type RefObject, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheet, type AppBottomSheetRef } from './AppBottomSheet';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { router } from 'expo-router';
import EntryButton from '../EntryButton';
import LinkAltIcon from '../../assets/icons/link-alt.svg';
import FolderIcon from '../../assets/icons/folder.svg';

interface Props {
  bottomSheetModalRef: RefObject<AppBottomSheetRef | null>;
}

const AddModelSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <AppBottomSheet ref={bottomSheetModalRef} dynamic>
      <View style={styles.sheetContent}>
        <Text style={styles.title}>Add model</Text>
        <View style={styles.buttonGroup}>
          <EntryButton
            icon={<LinkAltIcon width={22} height={22} style={styles.icon} />}
            text="From external URLs"
            onPress={() => {
              router.push('/add-remote-model');
              bottomSheetModalRef.current?.close();
            }}
          />
          <EntryButton
            icon={<FolderIcon width={20} height={17} style={styles.icon} />}
            text="From local files"
            onPress={() => {
              router.push('/add-local-model');
              bottomSheetModalRef.current?.close();
            }}
          />
        </View>
      </View>
    </AppBottomSheet>
  );
};

export default AddModelSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetContent: {
      paddingVertical: 24,
      paddingHorizontal: 16,
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
  });
