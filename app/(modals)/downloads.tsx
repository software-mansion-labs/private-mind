import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import { useActiveDownloads } from '../../hooks/useActiveDownloads';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useModelStore } from '../../store/modelStore';
import { Model } from '../../database/modelRepository';
import { Feedback } from '../../utils/Feedback';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../components/GlassScreenHeader';
import RowGroup, {
  TILE_ROW_TEXT_INSET,
} from '../../components/model-hub/RowGroup';
import DownloadedModelRow from '../../components/model-hub/DownloadedModelRow';
import DownloadingModelRow from '../../components/model-hub/DownloadingModelRow';
import { scrollIndicatorProps } from '../../constants/scroll-indicator';
import { radius, space, stroke } from '../../constants/design-system';

const DownloadsScreen = () => {
  const router = useRouter();
  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles } = useThemedStyles(createStyles, headerHeight);
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();

  const models = useModelStore((state) => state.models);
  const cancelDownload = useModelStore((state) => state.cancelDownload);
  const downloading = useActiveDownloads();
  const onDevice = useMemo(
    () => models.filter((m) => m.isDownloaded && m.source !== 'local'),
    [models]
  );
  const usedGB = onDevice.reduce((sum, m) => sum + (m.modelSize ?? 0), 0);

  const handleCancel = async (model: Model) => {
    Feedback.cancelDownload();
    await cancelDownload(model);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        {...scrollIndicatorProps(headerHeight)}
      >
        {downloading.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">
                Downloading · {downloading.length}
              </Text>
            </View>
            <RowGroup separatorInset={TILE_ROW_TEXT_INSET}>
              {downloading.map(({ model, progress, rate }) => (
                <DownloadingModelRow
                  key={model.id}
                  model={model}
                  progress={progress}
                  rate={rate}
                  onCancel={handleCancel}
                />
              ))}
            </RowGroup>
          </View>
        )}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              On this device · {onDevice.length}
            </Text>
            <Text style={styles.sectionSummary}>
              {usedGB.toFixed(2)} GB used
            </Text>
          </View>
          {onDevice.length > 0 ? (
            <RowGroup separatorInset={TILE_ROW_TEXT_INSET}>
              {onDevice.map((model) => (
                <DownloadedModelRow
                  key={model.id}
                  model={model}
                  onDelete={deleteModelFiles}
                />
              ))}
            </RowGroup>
          ) : (
            <Text style={styles.empty}>No models on this device yet.</Text>
          )}
        </View>
      </ScrollView>
      <GlassScreenHeader title="Downloads" onBack={() => router.back()} sheet />
      {ConfirmElement}
    </View>
  );
};

export default DownloadsScreen;

const createStyles = (theme: Theme, headerHeight: number) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      gap: space.six,
      paddingTop: headerHeight + space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
    },
    section: {
      gap: space.two,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      paddingHorizontal: space.one,
    },
    sectionTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
    },
    sectionSummary: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.xs,
      lineHeight: lineHeights.xs,
      color: theme.text.defaultTertiary,
    },
    empty: {
      padding: space.four,
      borderRadius: radius.twelve,
      borderWidth: stroke.soft,
      borderStyle: 'dashed',
      borderColor: theme.border.soft,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      textAlign: 'center',
      color: theme.text.defaultTertiary,
    },
  });
