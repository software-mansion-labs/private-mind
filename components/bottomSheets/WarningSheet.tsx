import React, { type RefObject, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppBottomSheet, type AppBottomSheetRef } from './AppBottomSheet';
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
  bottomSheetModalRef: RefObject<AppBottomSheetRef<WarningSheetData> | null>;
  onDismiss?: () => void;
}

const WarningSheet = ({ bottomSheetModalRef, onDismiss }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <AppBottomSheet<WarningSheetData>
      ref={bottomSheetModalRef}
      dynamic
      onDismiss={onDismiss}
    >
      {({ data }) => (
        <View style={styles.sheet}>
          <Text style={styles.title}>{data?.title}</Text>
          <Text style={styles.subText}>{data?.subtitle}</Text>
          <View style={styles.buttonGroup}>
            <PrimaryButton
              style={styles.downloadButton}
              text={data?.buttonTitle || 'OK'}
              onPress={() => {
                if (data?.onConfirm) {
                  data.onConfirm();
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
        </View>
      )}
    </AppBottomSheet>
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
