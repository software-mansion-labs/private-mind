import React, { useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetModalProvider,
} from '@gorhom/bottom-sheet';
import { useTheme } from '../../../context/ThemeContext';
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

const FamilyScreen = () => {
  const router = useRouter();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { family } = useLocalSearchParams<{ family: string }>();
  const familyName = decodeURIComponent(family ?? '');

  const { models } = useModelStore();

  const modelManagementSheetRef = useRef<BottomSheetModal | null>(null);
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

  return (
    <BottomSheetModalProvider>
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
            <ScrollView contentContainerStyle={styles.scrollContent}>
              {familyModels.map((model) => (
                <ModelCard
                  key={model.id}
                  model={model}
                  compactView={false}
                  onPress={() =>
                    modelManagementSheetRef.current?.present(model)
                  }
                  wifiWarningSheetRef={wifiWarningSheetRef}
                />
              ))}
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
  });
