import React, { RefObject, useMemo, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetFlatList,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import { router } from 'expo-router';
import { View, StyleSheet, Text, Platform } from 'react-native';
import { useModelStore } from '../../store/modelStore';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import { space, textStyles } from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import ModelPickerRow from '../model-hub/ModelPickerRow';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';
import { Feedback } from '../../utils/Feedback';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
  onModelPicked: (model: Model) => void;
  onSheetStateChange?: (isOpen: boolean) => void;
  currentModelId?: number;
}

const ModelSelectSheet = ({
  bottomSheetModalRef,
  onModelPicked,
  onSheetStateChange,
  currentModelId,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
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
    <BackDismissibleSheetModal
      ref={bottomSheetModalRef}
      index={snapIndex}
      snapPoints={['50%', '90%']}
      enableDynamicSizing={false}
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
          <View style={styles.header}>
            <Text style={styles.title}>Select a model</Text>
            <BottomSheetSearchInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search models"
            />
          </View>

          <BottomSheetFlatList
            data={filteredModels}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ paddingBottom: theme.insets.bottom + 16 }}
            renderItem={({ item }) => (
              <ModelPickerRow
                model={item}
                current={item.id === currentModelId}
                accessibilityRole="button"
                testIDPrefix="model-select"
                size="regular"
                onPress={() => {
                  onModelPicked(item);
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
            )}
          />
        </View>
      ) : (
        <BottomSheetView style={[styles.content, styles.emptyContent]}>
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
    </BackDismissibleSheetModal>
  );
};

export default ModelSelectSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      flex: 1,
      paddingTop: space.two,
      gap: space.three,
    },
    header: {
      gap: space.three,
      paddingHorizontal: space.four,
    },
    emptyContent: {
      gap: space.six,
      paddingHorizontal: space.four,
    },
    title: {
      ...textStyles.titleSheet,
      color: theme.text.primary,
    },
    subText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
