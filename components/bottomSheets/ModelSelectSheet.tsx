import React, { type RefObject, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { View, StyleSheet, Text, FlatList } from 'react-native';
import { AppBottomSheet, type AppBottomSheetRef } from './AppBottomSheet';
import { useModelStore } from '../../store/modelStore';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';
import { Feedback } from '../../utils/Feedback';

interface Props {
  bottomSheetModalRef: RefObject<AppBottomSheetRef | null>;
  selectModel: (model: Model) => void;
  onSheetStateChange?: (isOpen: boolean) => void;
}

const ModelSelectSheet = ({
  bottomSheetModalRef,
  selectModel,
  onSheetStateChange,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { downloadedModels } = useModelStore();
  const [search, setSearch] = useState('');

  const filteredModels = downloadedModels.filter((model) =>
    model.modelName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppBottomSheet
      ref={bottomSheetModalRef}
      snapPoints={['30%', '50%']}
      onChange={(index) => {
        if (index >= 0) Feedback.sheetOpen();
        onSheetStateChange?.(index >= 0);
      }}
      onDismiss={() => {
        onSheetStateChange?.(false);
      }}
    >
      {downloadedModels.length > 0 ? (
        <View style={styles.content}>
          <Text style={[styles.title, styles.horizontalInset]}>
            Select a Model
          </Text>
          <BottomSheetSearchInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search Models..."
          />

          <FlatList
            data={filteredModels}
            keyExtractor={(item) => item.id.toString()}
            // only frist two styles appear to be forwarded, so the array is
            // nested to make all styles be part of the first item
            contentContainerStyle={[
              [
                styles.modelList,
                styles.horizontalInset,
                { paddingBottom: theme.insets.bottom + 16 },
              ],
            ]}
            renderItem={({ item }) => (
              <ModelCard
                model={item}
                onPress={() => {
                  selectModel(item);
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
            )}
          />
        </View>
      ) : (
        <View style={[styles.content, styles.horizontalInset]}>
          <Text style={styles.title}>You have no available models yet</Text>
          <Text style={styles.subText}>
            To use Private Mind you need to have at least one model downloaded
          </Text>
          <PrimaryButton
            text="Download a Model"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              router.push('/model-hub');
            }}
          />
        </View>
      )}
    </AppBottomSheet>
  );
};

export default ModelSelectSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: 16,
      gap: 24,
    },
    horizontalInset: {
      paddingHorizontal: 16,
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
    modelList: {
      gap: 8,
    },
  });
