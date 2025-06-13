import React, { RefObject, useCallback } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { View, StyleSheet, Text } from 'react-native';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import { Model } from '../../database/modelRepository';
import { useModelStore } from '../../store/modelStore';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  selectModel: (model: Model) => void;
}

const ModelSelectSheet = ({ bottomSheetModalRef, selectModel }: Props) => {
  const { theme } = useTheme();
  const { downloadedModels } = useModelStore();

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        style={{
          backgroundColor: theme.bg.overlay,
        }}
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
      handleStyle={{
        backgroundColor: theme.bg.softPrimary,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
      backgroundStyle={{
        backgroundColor: theme.bg.softPrimary,
      }}
    >
      {downloadedModels.length > 0 ? (
        <View
          style={{
            ...styles.bottomSheet,
            backgroundColor: theme.bg.softPrimary,
          }}
        >
          <Text style={{ ...styles.title, color: theme.text.primary }}>
            Select a Model
          </Text>
          <BottomSheetFlatList
            data={downloadedModels}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ gap: 8, paddingBottom: 60 }}
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
