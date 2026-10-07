import React, { RefObject } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import SheetBackdrop from './SheetBackdrop';
import { createSheetStyles } from './sheetStyles';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';

export interface WarningSheetData {
  title: string;
  subtitle: string;
  buttonTitle?: string;
  onConfirm: () => void;
}

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal<WarningSheetData> | null>;
  onDismiss?: () => void;
}

const WarningSheet = ({ bottomSheetModalRef, onDismiss }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const { styles: sheet } = useThemedStyles(createSheetStyles);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={SheetBackdrop}
      enableDynamicSizing
      onDismiss={onDismiss}
      handleStyle={sheet.handle}
      handleIndicatorStyle={sheet.handleIndicator}
      backgroundStyle={sheet.background}
    >
      {(props) => (
        <BottomSheetView style={styles.sheet}>
          <Text style={styles.title}>{props.data?.title}</Text>
          <Text style={styles.subText}>{props.data?.subtitle}</Text>
          <View style={styles.buttonGroup}>
            <PrimaryButton
              style={styles.downloadButton}
              text={props.data?.buttonTitle || 'OK'}
              onPress={() => {
                if (props.data?.onConfirm) {
                  props.data.onConfirm();
                }
                bottomSheetModalRef.current?.dismiss();
              }}
            />
            <SecondaryButton
              text="Cancel"
              onPress={() => {
                bottomSheetModalRef.current?.dismiss();
              }}
            />
          </View>
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export default WarningSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    sheet: {
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
    subText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
    buttonGroup: {
      gap: 8,
    },
    downloadButton: {
      backgroundColor: theme.bg.errorPrimary,
    },
  });
