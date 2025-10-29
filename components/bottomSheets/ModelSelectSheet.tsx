import React, { RefObject, useCallback, useMemo, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { Model } from '../../database/modelRepository';
import ModelCard from '../model-hub/ModelCard';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  selectModel: (model: Model) => void;
}

const ModelSelectSheet = ({ bottomSheetModalRef, selectModel }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { downloadedModels } = useModelStore();
  const [search, setSearch] = useState('');

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
      snapPoints={['30%', '50%']}
      enableDynamicSizing={false}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
      keyboardBehavior={Platform.OS === 'ios' ? 'interactive' : 'fillParent'}
      keyboardBlurBehavior="restore"
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
                  selectModel(item);
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
            To use StudentsAI you need to have at least one model downloaded
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
