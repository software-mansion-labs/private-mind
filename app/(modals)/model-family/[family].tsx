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
import { fontFamily, fontSizes } from '../../../styles/fontStyles';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { getModelFamily } from '../../../utils/modelFamily';
import ModelCard from '../../../components/model-hub/ModelCard';
import ModelManagementSheet from '../../../components/bottomSheets/ModelManagementSheet';
import WarningSheet, {
  WarningSheetData,
} from '../../../components/bottomSheets/WarningSheet';
import ModalHeader from '../../../components/ModalHeader';
import RowGroup, { ROW_PADDING } from '../../../components/model-hub/RowGroup';
import { familyIcon, MODEL_FAMILIES } from '../../../constants/model-families';
import { scrollIndicatorProps } from '../../../constants/scroll-indicator';
import { radius, space, textStyles } from '../../../constants/design-system';

const HERO_TILE_SIZE = space.fourteen;
const HERO_ICON_SIZE = space.eight;

const FamilyScreen = () => {
  const router = useRouter();
  const { styles } = useThemedStyles(createStyles);
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

  const info = MODEL_FAMILIES[familyName];
  const Icon = familyIcon(familyName);

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <View style={styles.content}>
          <ModalHeader title="" onClose={() => router.back()} leftIcon="back" />
          {familyModels.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No variants available.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              {...scrollIndicatorProps()}
            >
              <View style={styles.hero}>
                <View style={styles.heroTile}>
                  <Icon
                    width={HERO_ICON_SIZE}
                    height={HERO_ICON_SIZE}
                    style={styles.heroIcon}
                  />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.familyName}>{familyName}</Text>
                  {info && <Text style={styles.provider}>{info.provider}</Text>}
                </View>
              </View>
              {info && (
                <Text style={styles.description}>{info.description}</Text>
              )}
              <RowGroup separatorInset={ROW_PADDING}>
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
                  />
                ))}
              </RowGroup>
            </ScrollView>
          )}
        </View>
        <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
        <WarningSheet bottomSheetModalRef={wifiWarningSheetRef} />
      </View>
    </BottomSheetModalProvider>
  );
};

export default FamilyScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.bg.softPrimary,
    },
    content: {
      flex: 1,
      padding: 16,
      paddingBottom: theme.insets.bottom,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      gap: space.four,
      paddingBottom: space.four,
    },
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.four,
    },
    heroTile: {
      width: HERO_TILE_SIZE,
      height: HERO_TILE_SIZE,
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.softSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroIcon: {
      color: theme.text.primary,
    },
    heroText: {
      flex: 1,
      gap: space.half,
    },
    familyName: {
      ...textStyles.titleH2,
      color: theme.text.primary,
    },
    provider: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
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
      lineHeight: 20,
    },
  });
