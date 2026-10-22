import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import { useThemedStyles } from '../../../hooks/useThemedStyles';
import { Theme } from '../../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../../styles/fontStyles';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { getModelFamily } from '../../../utils/modelFamily';
import ModelCard from '../../../components/model-hub/ModelCard';
import ModelManagementSheet from '../../../components/bottomSheets/ModelManagementSheet';
import WarningSheet, {
  WarningSheetData,
} from '../../../components/bottomSheets/WarningSheet';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../../components/GlassScreenHeader';
import ModelFamilyTile from '../../../components/model-hub/ModelFamilyTile';
import RowGroup from '../../../components/model-hub/RowGroup';
import FamilyProviderRow from '../../../components/model-hub/FamilyProviderRow';
import SectionHeader from '../../../components/model-hub/SectionHeader';
import {
  FAMILY_DESCRIPTIONS,
  FAMILY_PROVIDERS,
} from '../../../constants/family-descriptions';
import { scrollIndicatorProps } from '../../../constants/scroll-indicator';
import { space } from '../../../constants/design-system';

const FamilyScreen = () => {
  const router = useRouter();
  const headerHeight = useGlassScreenHeaderHeight(true);
  const { styles } = useThemedStyles(createStyles, headerHeight);
  const { family } = useLocalSearchParams<{ family: string }>();
  const familyName = decodeURIComponent(family ?? '');

  const { models } = useModelStore();

  const modelManagementSheetRef = useRef<BottomSheetModal<Model> | null>(null);
  const wifiWarningSheetRef = useRef<BottomSheetModal<WarningSheetData> | null>(
    null
  );

  const familyModels = useMemo(
    () =>
      models
        .filter((m: Model) => getModelFamily(m) === familyName)
        .sort((a, b) => (a.parameters ?? 0) - (b.parameters ?? 0)),
    [models, familyName]
  );

  const description = FAMILY_DESCRIPTIONS[familyName];
  const provider = FAMILY_PROVIDERS[familyName];
  const downloadedCount = familyModels.filter((m) => m.isDownloaded).length;
  const downloadedGB = familyModels
    .filter((m) => m.isDownloaded)
    .reduce((sum, m) => sum + (m.modelSize ?? 0), 0);
  const downloadedSummary =
    downloadedCount > 0
      ? `${downloadedCount} downloaded · ${downloadedGB.toFixed(2)} GB`
      : 'None downloaded';

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        {familyModels.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No variants available.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            {...scrollIndicatorProps(headerHeight)}
          >
            {provider && <FamilyProviderRow provider={provider} />}
            {description && (
              <Text style={styles.description}>{description}</Text>
            )}
            <View style={styles.section}>
              <SectionHeader
                title={`Variants · ${familyModels.length}`}
                summary={downloadedSummary}
              />
              <RowGroup separatorInset={0}>
                {familyModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    compactView={false}
                    variant="row"
                    onPress={() =>
                      modelManagementSheetRef.current?.present(model)
                    }
                    wifiWarningSheetRef={wifiWarningSheetRef}
                    showDeleteButton
                  />
                ))}
              </RowGroup>
            </View>
          </ScrollView>
        )}
        <GlassScreenHeader
          title={familyName}
          titleIcon={<ModelFamilyTile family={familyName} size="row" />}
          onBack={() => router.back()}
          sheet
        />
        <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
        <WarningSheet bottomSheetModalRef={wifiWarningSheetRef} />
      </View>
    </BottomSheetModalProvider>
  );
};

export default FamilyScreen;

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
      gap: space.five,
      paddingTop: headerHeight + space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
    },
    section: {
      gap: space.two,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    emptyText: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.md,
      color: theme.text.defaultSecondary,
    },
    description: {
      paddingHorizontal: space.one,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.sm,
    },
  });
