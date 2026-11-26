import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import { useThemedStyles } from '../../../../hooks/useThemedStyles';
import { Theme } from '../../../../styles/colors';
import {
  fontFamily,
  fontSizes,
  lineHeights,
} from '../../../../styles/fontStyles';
import { useModelStore } from '../../../../store/modelStore';
import { Model } from '../../../../database/modelRepository';
import { getModelFamily } from '../../../../utils/modelFamily';
import { huggingFaceRepoUrl } from '../../../../utils/huggingFaceRepoUrl';
import ModelDownloadRow from '../../../../components/model-hub/ModelDownloadRow';
import ModelManagementSheet from '../../../../components/bottomSheets/ModelManagementSheet';
import WarningSheet, {
  WarningSheetData,
} from '../../../../components/bottomSheets/WarningSheet';
import GlassScreenHeader, {
  useGlassScreenHeaderHeight,
} from '../../../../components/GlassScreenHeader';
import ModelFamilyTile from '../../../../components/model-hub/ModelFamilyTile';
import RowGroup from '../../../../components/model-hub/RowGroup';
import FamilyProviderRow from '../../../../components/model-hub/FamilyProviderRow';
import SwmAttributionCard from '../../../../components/model-hub/SwmAttributionCard';
import SwmAttributionContent from '../../../../components/model-hub/SwmAttributionContent';
import PushTransition from '../../../../components/model-hub/PushTransition';
import SectionHeader from '../../../../components/model-hub/SectionHeader';
import {
  FAMILY_DESCRIPTIONS,
  FAMILY_PROVIDERS,
  FAMILY_SWM_ROLES,
} from '../../../../constants/family-descriptions';
import { PUSH_TRANSITION_MS } from '../../../../constants/push-transition';
import { useBackToDismiss } from '../../../../hooks/useBackToDismiss';
import { scrollIndicatorProps } from '../../../../constants/scroll-indicator';
import { space } from '../../../../constants/design-system';

const HEADER_ICON_SIZE = 16;

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
  const attributionTitleRef = useRef<Text>(null);
  const [attributionOpen, setAttributionOpen] = useState(false);

  const familyModels = useMemo(
    () =>
      models
        .filter((m: Model) => getModelFamily(m) === familyName)
        .sort((a, b) => (a.parameters ?? 0) - (b.parameters ?? 0)),
    [models, familyName]
  );

  const description = FAMILY_DESCRIPTIONS[familyName];
  const provider = FAMILY_PROVIDERS[familyName];
  const swmRole = FAMILY_SWM_ROLES[familyName];
  const familyRepoUrl = familyModels
    .filter((m) => m.source === 'built-in')
    .map((m) => huggingFaceRepoUrl(m.modelPath))
    .find(Boolean);
  const downloadedCount = familyModels.filter((m) => m.isDownloaded).length;
  const downloadedGB = familyModels
    .filter((m) => m.isDownloaded)
    .reduce((sum, m) => sum + (m.modelSize ?? 0), 0);
  const downloadedSummary =
    downloadedCount > 0
      ? `${downloadedCount} downloaded · ${downloadedGB.toFixed(2)} GB`
      : 'None downloaded';

  const handleOpenAttribution = () => setAttributionOpen(true);
  const handleCloseAttribution = () => setAttributionOpen(false);
  const handleLeaveScreen = () => router.back();
  const handleHeaderBack = attributionOpen
    ? handleCloseAttribution
    : handleLeaveScreen;

  useBackToDismiss(attributionOpen, handleCloseAttribution);

  useEffect(() => {
    if (!attributionOpen) return;
    const timer = setTimeout(() => {
      const node = findNodeHandle(attributionTitleRef.current);
      if (node) AccessibilityInfo.setAccessibilityFocus(node);
    }, PUSH_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [attributionOpen]);

  const renderAttribution = () => {
    if (!provider) return null;
    if (!swmRole) return <FamilyProviderRow provider={provider} />;
    return (
      <SwmAttributionCard
        role={swmRole}
        provider={provider}
        onPress={handleOpenAttribution}
      />
    );
  };

  const details = (
    <>
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
          {renderAttribution()}
          {description && <Text style={styles.description}>{description}</Text>}
          <View style={styles.section}>
            <SectionHeader
              title={`Variants · ${familyModels.length}`}
              summary={downloadedSummary}
            />
            <RowGroup separatorInset={0}>
              {familyModels.map((model) => (
                <ModelDownloadRow
                  key={model.id}
                  model={model}
                  onPress={() =>
                    modelManagementSheetRef.current?.present(model)
                  }
                  wifiWarningSheetRef={wifiWarningSheetRef}
                />
              ))}
            </RowGroup>
          </View>
        </ScrollView>
      )}
    </>
  );

  const attribution =
    provider && swmRole ? (
      <SwmAttributionContent
        data={{
          family: familyName,
          provider,
          role: swmRole,
          modelUrl: familyRepoUrl,
        }}
        topInset={headerHeight}
        titleRef={attributionTitleRef}
      />
    ) : null;

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <PushTransition
          showSecond={attributionOpen}
          first={details}
          second={attribution}
        />
        <GlassScreenHeader
          title={familyName}
          titleIcon={
            <ModelFamilyTile
              family={familyName}
              size="row"
              bareIconSize={HEADER_ICON_SIZE}
            />
          }
          onBack={handleHeaderBack}
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
      padding: space.four,
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
