import React, { useMemo, useRef } from 'react';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
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
import RowGroup from '../../components/model-hub/RowGroup';
import ModelManagementSheet from '../../components/bottomSheets/ModelManagementSheet';
import DownloadedModelRow from '../../components/model-hub/DownloadedModelRow';
import DownloadingModelRow from '../../components/model-hub/DownloadingModelRow';
import SectionHeader from '../../components/model-hub/SectionHeader';
import { scrollIndicatorProps } from '../../constants/scroll-indicator';
import { radius, space, stroke } from '../../constants/design-system';

const DownloadsScreen = () => {
  const router = useRouter();
  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles } = useThemedStyles(createStyles, headerHeight);
  const { deleteModelFiles, ConfirmElement } = useDeleteModelFiles();
  const modelManagementSheetRef = useRef<BottomSheetModal<Model> | null>(null);

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
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          {...scrollIndicatorProps(headerHeight)}
        >
          {downloading.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={`Downloading · ${downloading.length}`} />
              <RowGroup separatorInset={0}>
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
            <SectionHeader
              title={`On this device · ${onDevice.length}`}
              summary={`${usedGB.toFixed(2)} GB used`}
            />
            {onDevice.length > 0 ? (
              <RowGroup separatorInset={0}>
                {onDevice.map((model) => (
                  <DownloadedModelRow
                    key={model.id}
                    model={model}
                    onDelete={deleteModelFiles}
                    onPress={(m) => modelManagementSheetRef.current?.present(m)}
                  />
                ))}
              </RowGroup>
            ) : (
              <Text style={styles.empty}>No models on this device yet.</Text>
            )}
          </View>
        </ScrollView>
        <GlassScreenHeader
          title="Downloads"
          onBack={() => router.back()}
          sheet
        />
        {ConfirmElement}
        <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
      </View>
    </BottomSheetModalProvider>
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
