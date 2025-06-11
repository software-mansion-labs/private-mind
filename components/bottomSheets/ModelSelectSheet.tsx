import React, { Dispatch, RefObject, SetStateAction, useCallback } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import { Model } from '../../database/modelRepository';
import { useModelStore } from '../../store/modelStore';
import { useLLMStore } from '../../store/llmStore';
import { useChatStore } from '../../store/chatStore';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  chatId: RefObject<number | null>;
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  model?: Model | null;
  selectModel?: Dispatch<SetStateAction<Model | null>>;
}

const ModelSelectSheet = ({
  chatId,
  bottomSheetModalRef,
  model,
  selectModel,
}: Props) => {
  const { theme } = useTheme();
  const { downloadedModels } = useModelStore();
  const { loadModel } = useLLMStore();
  const { setChatModel } = useChatStore();

  const handleSelectModel = async (selectedModel: Model) => {
    try {
      await loadModel(selectedModel);
      if (chatId.current && !model) {
        await setChatModel(chatId.current, selectedModel.id);
      }
      selectModel?.(selectedModel);
      bottomSheetModalRef.current?.dismiss();
    } catch (error) {
      console.error('Error loading model:', error);
    }
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.2}
      />
    ),
    []
  );
  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      snapPoints={['30%', '50%']}
      enableDynamicSizing={false}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
    >
      {downloadedModels.length > 0 ? (
        <View style={styles.bottomSheet}>
          <Text style={{ ...styles.title, color: theme.text.primary }}>
            Select a Model
          </Text>
          <BottomSheetFlatList
            data={downloadedModels}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
            renderItem={({ item }) => (
              <ModelCard model={item} onPress={handleSelectModel} />
            )}
          />
        </View>
      ) : (
        <BottomSheetView style={styles.bottomSheet}>
          <Text style={{ ...styles.title, color: theme.text.primary }}>
            You have no available models yet
          </Text>
          <Text
            style={{
              ...styles.bottomSheetSubText,
              color: theme.text.defaultSecondary,
            }}
          >
            To use Local Mind you need to have at least one model downloaded
          </Text>
          <PrimaryButton
            text="Open models list"
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

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.lg,
    fontFamily: fontFamily.medium,
  },
  modelItemText: {
    fontSize: 16,
  },
  bottomSheet: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 24,
  },
  bottomSheetSubText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.md,
  },
  bottomSheetIndicator: {
    width: 64,
    height: 4,
    borderRadius: 20,
  },
});

export default ModelSelectSheet;
