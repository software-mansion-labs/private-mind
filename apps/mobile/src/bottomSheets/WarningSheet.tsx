import React, { RefObject, useCallback, useMemo } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
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
}

const WarningSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
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
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
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
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    handleStyle: {
      backgroundColor: theme.bg.softPrimary,
      borderRadius: 16,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    background: {
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
