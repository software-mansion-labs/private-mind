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
import { useModelUpdate } from '../../hooks/useModelUpdate';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { Model } from '../../database/modelRepository';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { requiresUpdate } from '../../utils/modelUpdate';
import ModelPickerRow from '../model-hub/ModelPickerRow';
import PrimaryButton from '../PrimaryButton';
import BottomSheetSearchInput from './BottomSheetSearchInput';
import { Feedback } from '../../utils/Feedback';
import { DrawerItem } from '../drawer/DrawerItem';
import CubeIcon from '../../assets/icons/cube.svg';
import SearchOffIcon from '../../assets/icons/search-off.svg';

const LIST_SNAP_POINTS = ['50%', '90%'];
const UPDATE_SECTION_KEY = 'needs-update';

type SheetItem = { kind: 'model'; model: Model } | { kind: 'updateSection' };

const toItem = (model: Model): SheetItem => ({ kind: 'model', model });

const groupForPicker = (models: Model[]): SheetItem[] => {
  const ready = models.filter((model) => !requiresUpdate(model));
  const outdated = models.filter(requiresUpdate);
  if (outdated.length === 0) return ready.map(toItem);
  return [
    ...ready.map(toItem),
    { kind: 'updateSection' },
    ...outdated.map(toItem),
  ];
};
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
  const { updateModel, ConfirmElement } = useModelUpdate();
  const [search, setSearch] = useState('');
  const [snapIndex, setSnapIndex] = useState(0);
  const hasModels = downloadedModels.length > 0;

  const items = useMemo(() => {
    const needle = search.toLowerCase();
    return groupForPicker(
      downloadedModels.filter((model) =>
        model.modelName.toLowerCase().includes(needle)
      )
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
            data={items}
            keyExtractor={(item) =>
              item.kind === 'model'
                ? item.model.id.toString()
                : UPDATE_SECTION_KEY
            }
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
            renderItem={({ item }) =>
              item.kind === 'updateSection' ? (
                <View style={styles.updateSection} accessibilityRole="header">
                  <Text style={styles.updateSectionTitle}>
                    {MODEL_UPDATE_TEXT.pickerSectionTitle}
                  </Text>
                  <Text style={styles.updateSectionBody}>
                    {MODEL_UPDATE_TEXT.pickerSectionBody}
                  </Text>
                </View>
              ) : (
                <ModelPickerRow
                  model={item.model}
                  current={item.model.id === currentModelId}
                  accessibilityRole="button"
                  testIDPrefix="model-select"
                  onPress={() => {
                    onModelPicked(item.model);
                    bottomSheetModalRef.current?.dismiss();
                  }}
                  onUpdate={() => updateModel(item.model)}
                />
              )
            }
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
      {ConfirmElement}
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
      backgroundColor: theme.bg.sheetTile,
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
    updateSection: {
      marginTop: space.four,
      marginBottom: space.one,
      paddingHorizontal: space.four,
      gap: space.half,
    },
    updateSectionTitle: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultTertiary,
    },
    updateSectionBody: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultSecondary,
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
