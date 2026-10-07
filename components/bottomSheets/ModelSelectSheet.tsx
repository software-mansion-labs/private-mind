import React, { RefObject, useMemo, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import SheetBackdrop from './SheetBackdrop';
import { createSheetStyles } from './sheetStyles';
import { Model } from '../../database/modelRepository';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';
import { Feedback } from '../../utils/Feedback';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onModelPicked: (model: Model) => void;
  onSheetStateChange?: (isOpen: boolean) => void;
}

const ModelSelectSheet = ({
  bottomSheetModalRef,
  onModelPicked,
  onSheetStateChange,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { styles: sheet } = useThemedStyles(createSheetStyles);
  const downloadedModels = useModelStore((state) => state.downloadedModels);
  const [search, setSearch] = useState('');
  const [snapIndex, setSnapIndex] = useState(0);

  const filteredModels = useMemo(() => {
    const needle = search.toLowerCase();
    return downloadedModels.filter((model) =>
      model.modelName.toLowerCase().includes(needle)
    );
  }, [downloadedModels, search]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={SheetBackdrop}
      index={snapIndex}
      snapPoints={['30%', '50%']}
      enableDynamicSizing={false}
      handleStyle={sheet.handle}
      handleIndicatorStyle={sheet.handleIndicator}
      backgroundStyle={sheet.background}
      keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'fillParent'}
      keyboardBlurBehavior="restore"
      onChange={(index) => {
        if (index < 0) return;

        setSnapIndex(index);
        Feedback.sheetOpen();
        onSheetStateChange?.(true);
      }}
      onDismiss={() => {
        setSnapIndex(0);
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

          <BottomSheetFlatList
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
                  onModelPicked(item);
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
            )}
          />
        </View>
      ) : (
        <BottomSheetView style={[styles.content, styles.horizontalInset]}>
          <Text style={styles.title}>You have no available models yet</Text>
          <Text style={styles.subText}>
            To use Private Mind you need to have at least one model downloaded
          </Text>
          <PrimaryButton
            text="Download a Model"
            onPress={() => {
              bottomSheetModalRef.current?.dismiss();
              router.replace('/model-hub');
            }}
          />
        </BottomSheetView>
      )}
    </BottomSheetModal>
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
