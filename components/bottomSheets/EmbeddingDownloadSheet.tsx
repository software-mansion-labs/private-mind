import React, { RefObject, useCallback, useMemo } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { useEmbeddingModelStore } from '../../store/embeddingModelStore';
import { embeddingModelDownloadSizeLabel } from '../../utils/embeddingModel';

type Props = {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onDownload: () => void;
  onDismiss?: () => void;
};

const EmbeddingDownloadSheet = ({
  bottomSheetModalRef,
  onDownload,
  onDismiss,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const status = useEmbeddingModelStore((state) => state.status);
  const progress = useEmbeddingModelStore((state) => state.progress);

  const isDownloading = status === 'downloading';
  const isError = status === 'error';

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop]
  );

  const handleCancel = useCallback(
    () => bottomSheetModalRef.current?.dismiss(),
    [bottomSheetModalRef]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing
      onDismiss={onDismiss}
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={styles.sheet}>
        <Text style={styles.title}>Download document model</Text>
        <Text style={styles.subText}>
          {isError
            ? 'The document model could not be downloaded. Check your connection and try again.'
            : isDownloading
              ? 'You can close this sheet — the download keeps going in the background and resumes when you reopen it.'
              : `To attach documents, Private Mind needs to download the on-device embedding model once (~${embeddingModelDownloadSizeLabel()}). It is then reused for every future document.`}
        </Text>

        {isDownloading ? (
          <View style={styles.progressRow}>
            <View style={styles.progressBarContainer}>
              <View
                style={[styles.progressBar, { width: `${progress * 100}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.floor(progress * 100)}%
            </Text>
          </View>
        ) : (
          <View style={styles.buttonGroup}>
            <PrimaryButton
              text={isError ? 'Try again' : 'Download'}
              onPress={onDownload}
            />
            <SecondaryButton text="Cancel" onPress={handleCancel} />
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

export default EmbeddingDownloadSheet;

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
      borderRadius: 18,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: 9999,
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
    progressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    progressBarContainer: {
      flex: 1,
      height: 8,
      borderRadius: 9999,
      overflow: 'hidden',
      backgroundColor: theme.bg.softSecondary,
    },
    progressBar: {
      height: '100%',
      borderRadius: 9999,
      backgroundColor: theme.bg.strongPrimary,
    },
    progressText: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      minWidth: 40,
      textAlign: 'right',
    },
  });
