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
import { useModelStore } from '../../store/modelStore';
import { Model } from '../../database/modelRepository';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal<Model> | null>;
}

const MemoryWarningSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { downloadModel } = useModelStore();

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
          <Text style={styles.title}>Not enough memory to run this model.</Text>
          <Text style={styles.subText}>
            Your device may not have enough RAM to run this model smoothly. In
            some cases, using quantized models might be a solution due to their
            smaller size and lower memory requirements.
          </Text>
          <View style={styles.buttonGroup}>
            <PrimaryButton
              style={styles.downloadButton}
              text="Download anyway"
              onPress={async () => {
                if (props.data) downloadModel(props.data);
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

export default MemoryWarningSheet;

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
