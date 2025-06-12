import React, { RefObject, useCallback } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import { router } from 'expo-router';
import EntryButton from '../EntryButton';
import LinkAltIcon from '../../assets/icons/link-alt.svg';
import FolderIcon from '../../assets/icons/folder.svg';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

const AddModelSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.2}
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={true}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
    >
      <BottomSheetView style={styles.bottomSheet}>
        <Text style={{ ...styles.title, color: theme.text.primary }}>
          Add model
        </Text>
        <View style={{ gap: 8 }}>
          <EntryButton
            icon={<LinkAltIcon width={22} height={22} />}
            text={'From external URLs'}
            onPress={() => {
              router.push('/modal/add-remote-model');
              bottomSheetModalRef.current?.close();
            }}
          />
          <EntryButton
            icon={<FolderIcon width={20} height={17} />}
            text={'From local files'}
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

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
    paddingBottom: 36,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
});

export default AddModelSheet;
