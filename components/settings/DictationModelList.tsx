import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useConfirm } from '../../hooks/useConfirm';
import { useSTTStore } from '../../store/sttStore';
import {
  STT_MODEL_KINDS,
  type SttModelKind,
  whisperDownloadSizeLabel,
} from '../../utils/sttModelFiles';
import { formatDownloadPercent } from '../../utils/downloadProgress';
import { Feedback } from '../../utils/Feedback';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { space } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SettingsRowGroup from './SettingsRowGroup';
import SectionHeader from '../model-hub/SectionHeader';
import TextButton from '../TextButton';

type DictationModelStatus = 'downloaded' | 'downloading' | 'missing';

const MODEL_NAMES: Record<SttModelKind, string> = {
  english: 'English',
  multilingual: 'Multilingual',
};

const MODEL_DESCRIPTIONS: Record<SttModelKind, string> = {
  english: 'Whisper Tiny, English only',
  multilingual: 'Whisper Tiny, 99 languages',
};

const ACTION_LABELS: Record<DictationModelStatus, string> = {
  downloaded: 'Delete',
  downloading: 'Cancel',
  missing: 'Download',
};

export const dictationModelStatus = (
  kind: SttModelKind,
  state: {
    onDisk: Record<SttModelKind, boolean>;
    fetchingKind: SttModelKind | null;
  }
): DictationModelStatus => {
  if (state.fetchingKind === kind) return 'downloading';
  if (state.onDisk[kind]) return 'downloaded';
  return 'missing';
};

const statusLabel = (
  kind: SttModelKind,
  status: DictationModelStatus,
  progress: number
) => {
  const size = whisperDownloadSizeLabel(kind);
  if (status === 'downloading') {
    return `Downloading ${formatDownloadPercent(progress)}`;
  }
  if (status === 'downloaded') return `On this device · ${size}`;
  return `Not downloaded · ${size}`;
};

export const DictationModelList = () => {
  const { styles } = useThemedStyles(createStyles);
  const { confirm, ConfirmElement } = useConfirm();
  const onDisk = useSTTStore((state) => state.onDisk);
  const fetchingKind = useSTTStore((state) => state.fetchingKind);
  const filesProgress = useSTTStore((state) => state.filesProgress);

  useEffect(() => {
    useSTTStore.getState().refreshOnDisk();
  }, []);

  const handleDelete = async (kind: SttModelKind) => {
    const confirmed = await confirm({
      title: `Delete the ${MODEL_NAMES[kind].toLowerCase()} speech model?`,
      message: `This frees ${whisperDownloadSizeLabel(kind)}. Dictation downloads it again the next time it needs it.`,
      confirmLabel: 'Delete',
    });
    if (!confirmed) return;
    await useSTTStore.getState().deleteModelFiles(kind);
    Feedback.destructive();
  };

  const handleAction = (kind: SttModelKind, status: DictationModelStatus) => {
    if (status === 'downloaded') return handleDelete(kind);
    if (status === 'downloading') {
      return useSTTStore.getState().cancelFetchFiles();
    }
    return useSTTStore.getState().fetchFiles(kind);
  };

  const renderModel = (kind: SttModelKind) => {
    const status = dictationModelStatus(kind, { onDisk, fetchingKind });
    const handlePress = () => handleAction(kind, status);
    return (
      <View key={kind} style={styles.row} testID={`dictation-model-${kind}`}>
        <View style={styles.texts}>
          <Text
            style={styles.name}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {MODEL_NAMES[kind]}
          </Text>
          <Text
            style={styles.detail}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {MODEL_DESCRIPTIONS[kind]}
          </Text>
          <Text
            style={styles.detail}
            testID={`dictation-model-${kind}-status`}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {statusLabel(kind, status, filesProgress)}
          </Text>
        </View>
        <TextButton
          text={ACTION_LABELS[status]}
          onPress={handlePress}
          textStyle={status === 'downloaded' ? styles.destructive : undefined}
        />
      </View>
    );
  };

  return (
    <View style={styles.section}>
      <SectionHeader title="Speech models" />
      <SettingsRowGroup separatorInset={0}>
        {STT_MODEL_KINDS.map(renderModel)}
      </SettingsRowGroup>
      {ConfirmElement}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    section: {
      gap: space.two,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: space.four,
    },
    texts: {
      flex: 1,
      gap: space.half,
    },
    name: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    detail: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    destructive: {
      color: theme.text.error,
    },
  });
