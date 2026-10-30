import React, { RefObject } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { router } from 'expo-router';
import EntryButton from '../EntryButton';
import LinkAltIcon from '../../assets/icons/link-alt.svg';
import FolderIcon from '../../assets/icons/folder.svg';
import { space } from '../../constants/design-system';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

const AddModelSheet = ({ bottomSheetModalRef }: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <BackDismissibleSheetModal ref={bottomSheetModalRef} enableDynamicSizing>
      <BottomSheetView style={styles.sheetContent}>
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
      </BottomSheetView>
    </BackDismissibleSheetModal>
  );
};

export default AddModelSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheetContent: {
      paddingVertical: space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + 16,
      gap: space.six,
      backgroundColor: theme.bg.softPrimary,
    },
    title: {
      fontSize: fontSizes.lg,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    buttonGroup: {
      gap: space.two,
    },
    icon: {
      color: theme.text.primary,
    },
  });
