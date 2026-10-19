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
import {
  FAMILY_DESCRIPTIONS,
  FAMILY_PROVIDERS,
} from '../../../constants/family-descriptions';
import { scrollIndicatorProps } from '../../../constants/scroll-indicator';
import { space, textStyles } from '../../../constants/design-system';

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
  const downloadedSummary = `${downloadedCount} of ${familyModels.length} downloaded`;

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
            <View style={styles.hero}>
              <ModelFamilyTile family={familyName} size="hero" />
              <View style={styles.heroText}>
                <Text style={styles.familyName}>{familyName}</Text>
                <Text style={styles.heroMeta}>
                  {provider
                    ? `${provider} · ${downloadedSummary}`
                    : downloadedSummary}
                </Text>
              </View>
            </View>
            {description && (
              <Text style={styles.description}>{description}</Text>
            )}
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
          </ScrollView>
        )}
        <GlassScreenHeader title="" onBack={() => router.back()} sheet />
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
      gap: space.four,
      paddingTop: headerHeight + space.six,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.four,
    },
    heroText: {
      flex: 1,
      gap: space.half,
    },
    familyName: {
      ...textStyles.titleH2,
      color: theme.text.primary,
    },
    heroMeta: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
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
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.defaultSecondary,
      lineHeight: lineHeights.sm,
    },
  });
