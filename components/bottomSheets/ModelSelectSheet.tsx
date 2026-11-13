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
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import ModelPickerRow from '../model-hub/ModelPickerRow';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';
import { Feedback } from '../../utils/Feedback';
import { DrawerItem } from '../drawer/DrawerItem';
import CubeIcon from '../../assets/icons/cube.svg';
import SearchOffIcon from '../../assets/icons/search-off.svg';

const LIST_SNAP_POINTS = ['50%', '90%'];
const ICON_CIRCLE_SIZE = 56;

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
  const hasModels = downloadedModels.length > 0;

  const filteredModels = useMemo(() => {
    const needle = search.toLowerCase();
    return downloadedModels.filter((model) =>
      model.modelName.toLowerCase().includes(needle)
    );
  }, [downloadedModels, search]);

  const goToModelHub = () => {
    bottomSheetModalRef.current?.dismiss();
    router.replace('/model-hub');
  };

  return (
    <BackDismissibleSheetModal
      ref={bottomSheetModalRef}
      index={snapIndex}
      snapPoints={hasModels ? LIST_SNAP_POINTS : undefined}
      enableDynamicSizing={!hasModels}
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
      {hasModels ? (
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
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.searchEmpty}>
                <View style={styles.iconCircle}>
                  <SearchOffIcon
                    width={24}
                    height={24}
                    style={styles.iconCircleIcon}
                  />
                </View>
                <Text style={styles.searchEmptyTitle}>
                  No models match "{search}"
                </Text>
                <View style={styles.searchEmptyAction}>
                  <DrawerItem
                    icon={
                      <CubeIcon
                        width={18}
                        height={18}
                        style={styles.actionIcon}
                      />
                    }
                    label="Manage models"
                    testID="model-select-empty-manage-models"
                    active={false}
                    hugContent
                    onPress={goToModelHub}
                  />
                </View>
              </View>
            }
            renderItem={({ item }) => (
              <ModelPickerRow
                model={item}
                current={item.id === currentModelId}
                accessibilityRole="button"
                testIDPrefix="model-select"
                onPress={() => {
                  onModelPicked(item);
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
            )}
          />
        </View>
      ) : (
        <BottomSheetView style={styles.emptyContent}>
          <Text style={styles.title}>You have no available models yet</Text>
          <Text style={styles.subText}>
            To use Private Mind you need to have at least one model downloaded
          </Text>
          <PrimaryButton text="Download a Model" onPress={goToModelHub} />
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
      paddingTop: space.two,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + 16,
      gap: space.six,
    },
    title: {
      ...textStyles.titleSheet,
      color: theme.text.primary,
    },
    searchEmpty: {
      paddingHorizontal: space.six,
      paddingVertical: space.ten,
      alignItems: 'center',
      gap: space.four,
    },
    iconCircle: {
      width: ICON_CIRCLE_SIZE,
      height: ICON_CIRCLE_SIZE,
      borderRadius: radius.full,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.tile,
    },
    iconCircleIcon: {
      color: theme.text.defaultSecondary,
    },
    searchEmptyTitle: {
      textAlign: 'center',
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.md,
      lineHeight: 22,
      color: theme.text.primary,
    },
    searchEmptyAction: {
      alignSelf: 'center',
      overflow: 'hidden',
      borderRadius: radius.full,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
    },
    actionIcon: {
      color: theme.text.primary,
    },
    subText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.defaultSecondary,
    },
  });
