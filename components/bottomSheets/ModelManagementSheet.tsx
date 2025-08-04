import React, { RefObject, useCallback, useMemo, useState } from 'react';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { Theme } from '../../styles/colors';
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
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { removeModel, removeModelFiles } = useModelStore();
  const [stage, setStage] = useState<ModalStage>(ModalStage.Initial);

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

  const renderStageContent = (model: Model) => {
    switch (stage) {
      case ModalStage.Initial:
        return (
          <>
            <ModelCard model={model} onPress={() => {}} />
            <View style={styles.buttonGroup}>
              {model.source !== 'built-in' && (
                <EntryButton
                  text="Edit model"
                  icon={
                    <EditIcon
                      width={18}
                      height={20}
                      style={styles.iconPrimary}
                    />
                  }
                  onPress={() => {
                    router.push(
                      model.source === 'remote'
                        ? `modal/edit-remote-model/${model.id}`
                        : `modal/edit-local-model/${model.id}`
                    );
                    bottomSheetModalRef.current?.dismiss();
                  }}
                />
              )}

              {model.source !== 'local' && model.isDownloaded && (
                <EntryButton
                  text="Delete downloaded files"
                  icon={
                    <ThrashIcon
                      width={18}
                      height={19}
                      style={styles.iconImportant}
                    />
                  }
                  onPress={() => setStage(ModalStage.RemoveFiles)}
                />
              )}

              {model.source !== 'built-in' && (
                <EntryButton
                  text="Remove from the app"
                  textStyle={styles.textError}
                  icon={
                    <CrossCircleIcon
                      width={20}
                      height={20}
                      style={styles.iconError}
                    />
                  }
                  onPress={() => setStage(ModalStage.RemoveModel)}
                />
              )}
            </View>
          </>
        );

      case ModalStage.RemoveFiles:
        return (
          <>
            <Text style={styles.title}>
              Are you sure you want to delete files of this model?
            </Text>
            <Text style={styles.subText}>
              You won’t be able to use this model, but you can always redownload
              the files.
            </Text>
            <View style={styles.buttonGroup}>
              <PrimaryButton
                text="Delete model files"
                onPress={async () => {
                  await removeModelFiles(model.id);
                  Toast.show({
                    type: 'defaultToast',
                    text1: `${model.modelName} has been successfully deleted`,
                  });
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
              <SecondaryButton
                text="Close"
                onPress={() => setStage(ModalStage.Initial)}
              />
            </View>
          </>
        );

      case ModalStage.RemoveModel:
        return (
          <>
            <Text style={styles.title}>
              Are you sure you want permanently remove this model from the app?
            </Text>
            <Text style={styles.subText}>
              It will delete the model files and stored external URLs. You can
              always add this model again manually.
            </Text>
            <View style={styles.buttonGroup}>
              <PrimaryButton
                text="Delete model files"
                style={styles.buttonDestructive}
                onPress={async () => {
                  await removeModel(model.id);
                  Toast.show({
                    type: 'defaultToast',
                    text1: `${model.modelName} has been successfully deleted`,
                  });
                  bottomSheetModalRef.current?.dismiss();
                }}
              />
              <SecondaryButton
                text="Close"
                onPress={() => setStage(ModalStage.Initial)}
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
      enableDynamicSizing
      onChange={() => setStage(ModalStage.Initial)}
      handleStyle={styles.handle}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={styles.background}
    >
      {(props) => (
        <BottomSheetView style={styles.container}>
          {renderStageContent(props.data)}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
};

export default ModelManagementSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingVertical: 24,
      paddingHorizontal: 16,
      paddingBottom: theme.insets.bottom + 16,
      gap: 24,
      backgroundColor: theme.bg.softPrimary,
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
    buttonGroup: {
      gap: 8,
    },
    textError: {
      color: theme.text.error,
    },
    iconPrimary: {
      color: theme.text.primary,
    },
    iconImportant: {
      color: theme.bg.strongPrimary,
    },
    iconError: {
      color: theme.text.error,
    },
    buttonDestructive: {
      backgroundColor: theme.bg.errorPrimary,
    },
    backdrop: {
      backgroundColor: theme.bg.overlay,
    },
    handle: {
      borderRadius: 16,
      backgroundColor: theme.bg.softPrimary,
    },
    handleIndicator: {
      backgroundColor: theme.text.primary,
      width: 64,
      height: 4,
      borderRadius: 20,
    },
    background: {
      backgroundColor: theme.bg.softPrimary,
    },
  });
