import React, { RefObject, useCallback } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import {
  useEmbeddingModelStore,
  type EmbeddingModelStatus,
} from '../../store/embeddingModelStore';
import { embeddingModelDownloadSizeLabel } from '../../utils/embeddingModel';

type DownloadContext = 'document' | 'web';

type Props = {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onDownload: () => void;
  onDismiss?: () => void;
  context?: DownloadContext;
  required?: boolean;
};

const TITLES: Record<DownloadContext, string> = {
  document: 'Download document model',
  web: 'Download search model',
};

const READY_SUBTEXT: Record<DownloadContext, string> = {
  document:
    'To attach documents, Private Mind needs to download the on-device embedding model once (~{size}). It is then reused for every future document.',
  web: 'Web search gives better results with the on-device embedding model (~{size}) — it ranks pages by actual relevance instead of keyword matches alone. It is downloaded once and reused for documents too.',
};

const REQUIRED_WEB_SUBTEXT =
  'Your device can comfortably run the on-device embedding model (~{size}), so web search requires it for accurate, relevant results. It is downloaded once and reused for documents too.';

const ERROR_SUBTEXT: Record<DownloadContext, string> = {
  document:
    'The document model could not be downloaded. Check your connection and try again.',
  web: 'The search model could not be downloaded. Check your connection and try again.',
};

const DOWNLOADING_SUBTEXT =
  'You can close this sheet — the download keeps going in the background and resumes when you reopen it.';

const readySubText = (context: DownloadContext, required: boolean): string => {
  const template =
    required && context === 'web'
      ? REQUIRED_WEB_SUBTEXT
      : READY_SUBTEXT[context];
  return template.replace('{size}', embeddingModelDownloadSizeLabel());
};

const subTextFor = (
  status: EmbeddingModelStatus,
  context: DownloadContext,
  required: boolean
): string => {
  switch (status) {
    case 'error':
      return ERROR_SUBTEXT[context];
    case 'downloading':
      return DOWNLOADING_SUBTEXT;
    default:
      return readySubText(context, required);
  }
};

const EmbeddingDownloadSheet = ({
  bottomSheetModalRef,
  onDownload,
  onDismiss,
  context = 'document',
  required = false,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const status = useEmbeddingModelStore((state) => state.status);
  const progress = useEmbeddingModelStore((state) => state.progress);

  const isDownloading = status === 'downloading';
  const isError = status === 'error';
  const blockDismiss = required && status === 'not_downloaded';

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior={blockDismiss ? 'none' : 'close'}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop, blockDismiss]
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
      enablePanDownToClose={!blockDismiss}
      onDismiss={onDismiss}
      handleStyle={styles.handleStyle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      <BottomSheetView style={styles.sheet}>
        <Text style={styles.title}>{TITLES[context]}</Text>
        <Text style={styles.subText}>
          {subTextFor(status, context, required)}
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
            {!blockDismiss ? (
              <SecondaryButton text="Cancel" onPress={handleCancel} />
            ) : null}
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
