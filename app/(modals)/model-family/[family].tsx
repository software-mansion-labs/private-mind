import React, { useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BottomSheetProvider } from '@swmansion/react-native-bottom-sheet';
import type { AppBottomSheetRef } from '../../../components/bottomSheets/AppBottomSheet';
import { useTheme } from '../../../context/ThemeContext';
import { Theme } from '../../../styles/colors';
import { fontFamily, fontSizes } from '../../../styles/fontStyles';
import { useModelStore } from '../../../store/modelStore';
import { Model } from '../../../database/modelRepository';
import { getModelFamily } from '../../../utils/modelFamily';
import ModelCard from '../../../components/model-hub/ModelCard';
import ModelManagementSheet from '../../../components/bottomSheets/ModelManagementSheet';
import WarningSheet, {
  type WarningSheetData,
} from '../../../components/bottomSheets/WarningSheet';
import ModalHeader from '../../../components/ModalHeader';
import { FAMILY_DESCRIPTIONS } from '../../../constants/family-descriptions';

const FamilyScreen = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { family } = useLocalSearchParams<{ family: string }>();
  const familyName = decodeURIComponent(family ?? '');

  const { models } = useModelStore();

  const modelManagementSheetRef = useRef<AppBottomSheetRef<Model> | null>(null);
  const wifiWarningSheetRef =
    useRef<AppBottomSheetRef<WarningSheetData> | null>(null);

  const familyModels = useMemo(
    () =>
      models
        .filter((m: Model) => getModelFamily(m) === familyName)
        .sort((a, b) => (a.parameters ?? 0) - (b.parameters ?? 0)),
    [models, familyName]
  );

  const description = FAMILY_DESCRIPTIONS[familyName];

  return (
    <BottomSheetProvider>
      <View style={styles.container}>
        <View style={styles.content}>
          <ModalHeader
            title={familyName}
            onClose={() => router.back()}
            leftIcon="back"
          />
          {familyModels.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No variants available.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              automaticallyAdjustsScrollIndicatorInsets={false}
              scrollIndicatorInsets={scrollIndicatorInsets}
            >
              {description && (
                <Text style={styles.description}>{description}</Text>
              )}
              {familyModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  compactView={false}
                  onPress={() =>
                    modelManagementSheetRef.current?.present(model)
                  }
                  wifiWarningSheetRef={wifiWarningSheetRef}
                  showDeleteButton
                />
              ))}
            </ScrollView>
          )}
        </View>
        <ModelManagementSheet bottomSheetModalRef={modelManagementSheetRef} />
        <WarningSheet bottomSheetModalRef={wifiWarningSheetRef} />
      </View>
    </BottomSheetProvider>
  );
};

export default FamilyScreen;

const scrollIndicatorInsets = Platform.select({
  // iOS 17.5 can initially place the indicator on the left when auto-adjusting.
  ios: { right: 1 },
});

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
      gap: 8,
      paddingBottom: 16,
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
      marginBottom: 8,
    },
  });
