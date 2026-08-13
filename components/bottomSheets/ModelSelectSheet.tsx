import React, { RefObject, useCallback, useRef, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';
import { Feedback } from '../../utils/Feedback';

const MODEL_SHEET_SNAP_POINTS: Array<string | number> = ['30%', '50%'];

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  selectModel: (model: Model) => void;
  onPendingModelChange?: (model: Model) => void;
  onSheetStateChange?: (isOpen: boolean) => void;
}

const ModelSelectSheet = ({
  bottomSheetModalRef,
  selectModel,
  onPendingModelChange,
  onSheetStateChange,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { downloadedModels } = useModelStore();
  const [search, setSearch] = useState('');
  const pendingModelRef = useRef<Model | null>(null);
  const selectionPendingRef = useRef(false);
  const currentSnapIndexRef = useRef(0);

  const filteredModels = downloadedModels.filter((model) =>
    model.modelName.toLowerCase().includes(search.toLowerCase())
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={styles.backdrop}
      />
    ),
    [styles.backdrop]
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      index={currentSnapIndexRef.current}
      snapPoints={MODEL_SHEET_SNAP_POINTS}
      enableDynamicSizing={false}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'fillParent'}
      keyboardBlurBehavior="none"
      onChange={(index) => {
        if (index < 0) return;

        currentSnapIndexRef.current = index;
        Feedback.sheetOpen();
        onSheetStateChange?.(true);
      }}
      onDismiss={() => {
        currentSnapIndexRef.current = 0;
        onSheetStateChange?.(false);

        const pendingModel = pendingModelRef.current;
        pendingModelRef.current = null;
        selectionPendingRef.current = false;
        if (pendingModel) {
          // onDismiss is emitted at the animation boundary. Give React a
          // chance to commit the closed state and iOS two quiet frames before
          // model initialization can put pressure on the UI thread.
          requestAnimationFrame(() => {
            requestAnimationFrame(() => selectModel(pendingModel));
          });
        }
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
                  if (selectionPendingRef.current) return;

                  // Update only the lightweight header immediately. Model
                  // unloading/loading still waits for the native dismissal
                  // animation and two quiet frames below.
                  selectionPendingRef.current = true;
                  pendingModelRef.current = item;
                  onPendingModelChange?.(item);
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
              router.push('/model-hub');
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
    handle: {
      backgroundColor: theme.bg.softPrimary,
      borderRadius: 16,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: 20,
      backgroundColor: theme.text.primary,
    },
    background: {
      backgroundColor: theme.bg.softPrimary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
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
