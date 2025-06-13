import React, { RefObject, useCallback, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontFamily';
import { useTheme } from '../../context/ThemeContext';
import EntryButton from '../EntryButton';
import ModelCard from '../model-hub/ModelCard';
import ThrashIcon from '../../assets/icons/trash.svg';
import EditIcon from '../../assets/icons/edit.svg';
import CrossCircleIcon from '../../assets/icons/cross-circle.svg';
import { useModelStore } from '../../store/modelStore';
import { Model } from '../../database/modelRepository';
import Toast from 'react-native-toast-message';
import PrimaryButton from '../PrimaryButton';
import SecondaryButton from '../SecondaryButton';
import { router } from 'expo-router';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal | null>;
}

enum ModalStage {
  Initial,
  RemoveFiles,
  RemoveModel,
}

const ModelManagementSheet = ({ bottomSheetModalRef }: Props) => {
  const { theme } = useTheme();
  const { removeModel, removeModelFiles } = useModelStore();
  const [stage, setStage] = useState<ModalStage>(ModalStage.Initial);

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

  const renderStageContent = (model: Model) => {
    switch (stage) {
      case ModalStage.Initial:
        return (
          <>
            <ModelCard model={model} onPress={() => {}} />
            <View style={{ gap: 8 }}>
              {model.source !== 'built-in' && (
                <EntryButton
                  text="Edit model"
                  icon={
                    <EditIcon
                      width={18}
                      height={20}
                      style={{ color: theme.text.primary }}
                    />
                  }
                  onPress={() => {
                    if (model.source === 'remote') {
                      router.push(`modal/edit-remote-model/${model.id}`);
                    } else if (model.source === 'local') {
                      router.push(`modal/edit-local-model/${model.id}`);
                    }

                    bottomSheetModalRef.current?.dismiss();
                  }}
                />
              )}
              {model.source !== 'local' && (
                <EntryButton
                  text="Delete downloaded files"
                  icon={
                    <ThrashIcon
                      width={18}
                      height={19}
                      style={{ color: theme.bg.strongPrimary }}
                    />
                  }
                  onPress={() => {
                    setStage(ModalStage.RemoveFiles);
                  }}
                />
              )}
              {model.source !== 'built-in' && (
                <EntryButton
                  text="Remove from the app"
                  textStyle={{ color: theme.text.error }}
                  icon={
                    <CrossCircleIcon
                      width={20}
                      height={20}
                      style={{ color: theme.text.error }}
                    />
                  }
                  onPress={() => {
                    setStage(ModalStage.RemoveModel);
                  }}
                />
              )}
            </View>
          </>
        );
      case ModalStage.RemoveFiles:
        return (
          <>
            <Text style={{ ...styles.title, color: theme.text.primary }}>
              Are you sure you want to delete files of this model?
            </Text>
            <Text
              style={{
                ...styles.bottomSheetSubText,
                color: theme.text.defaultSecondary,
              }}
            >
              You won’t be able to use this model, but you can always redownload
              the files.
            </Text>
            <View style={{ gap: 8 }}>
              <PrimaryButton
                text="Delete model files"
                onPress={async () => {
                  await removeModelFiles(model.id);
                  Toast.show({
                    type: 'defaultToast',
                    text1: `${model.id} has been successfully deleted`,
                    props: { backgroundColor: '#020f3c' },
                  });
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
              <SecondaryButton
                text="Close"
                onPress={() => {
                  setStage(ModalStage.Initial);
                }}
              />
            </View>
          </>
        );
      case ModalStage.RemoveModel:
        return (
          <>
            <Text style={{ ...styles.title, color: theme.text.primary }}>
              Are you sure you want permanently remove this model from the app?
            </Text>
            <Text
              style={{
                ...styles.bottomSheetSubText,
                color: theme.text.defaultSecondary,
              }}
            >
              It will delete the model files and stored external urls. You can
              always add this model to the app again manually.
            </Text>
            <View style={{ gap: 8 }}>
              <PrimaryButton
                style={{ backgroundColor: theme.bg.errorPrimary }}
                text="Delete model files"
                onPress={async () => {
                  await removeModel(model.id);
                  Toast.show({
                    type: 'defaultToast',
                    text1: `${model.id} has been successfully deleted`,
                    props: { backgroundColor: '#020f3c' },
                  });
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
              <SecondaryButton
                text="Close"
                onPress={() => {
                  setStage(ModalStage.Initial);
                }}
              />
            </View>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      backdropComponent={renderBackdrop}
      enableDynamicSizing={true}
      onChange={() => {
        setStage(ModalStage.Initial);
      }}
      handleStyle={{
        backgroundColor: theme.bg.softPrimary,
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.text.primary,
        ...styles.bottomSheetIndicator,
      }}
    >
      {(props) => {
        return (
          <BottomSheetView
            style={{
              ...styles.bottomSheet,
              backgroundColor: theme.bg.softPrimary,
            }}
          >
            {renderStageContent(props.data)}
          </BottomSheetView>
        );
      }}
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
    paddingBottom: 36,
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

export default ModelManagementSheet;
