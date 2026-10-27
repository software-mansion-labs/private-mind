import React, { RefObject } from 'react';
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import BackDismissibleSheetModal from './BackDismissibleSheetModal';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { radius, space, stroke } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import ModelCapabilityBadges from '../model-hub/ModelCapabilityBadges';
import ModelRow from '../model-hub/ModelRow';
import ModelRowText from '../model-hub/ModelRowText';
import DownloadedBadge from '../model-hub/DownloadedBadge';
import ChatIcon from '../../assets/icons/chat.svg';
import TrashIcon from '../../assets/icons/trash.svg';
import EditIcon from '../../assets/icons/edit.svg';
import CrossCircleIcon from '../../assets/icons/cross-circle.svg';
import BenchmarkIcon from '../../assets/icons/benchmark.svg';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';
import { FAMILY_PROVIDERS } from '../../constants/family-descriptions';
import { isModelCompatible } from '../../utils/modelCompatibility';
import { getModelFamily } from '../../utils/modelFamily';
import { modelSpecParts } from '../../utils/modelMeta';
import { startPhantomChat } from '../../utils/startPhantomChat';
import { useModelStore } from '../../store/modelStore';
import { useDeleteModelFiles } from '../../hooks/useDeleteModelFiles';
import { useConfirm } from '../../hooks/useConfirm';
import { Model } from '../../database/modelRepository';
import Toast from 'react-native-toast-message';
import { router } from 'expo-router';
import { Feedback } from '../../utils/Feedback';
import { SvgComponent } from '../../utils/SvgComponent';

interface Props {
  bottomSheetModalRef: RefObject<BottomSheetModal<Model> | null>;
}

const ACTION_ROW_MIN_HEIGHT = 52;
const ACTION_WELL_SIZE = 32;
const ACTION_WELL_RADIUS = 10;
const ACTION_ICON_SIZE = 16;
const CHEVRON_WIDTH = 7;
const CHEVRON_HEIGHT = 12;
const CHEVRON_OPACITY = 0.5;

type ActionTone = 'accent' | 'neutral' | 'destructive';

interface Action {
  key: string;
  label: string;
  icon: SvgComponent;
  tone: ActionTone;
  onPress: () => void;
}

const modelMeta = (model: Model) =>
  [
    model.source === 'built-in'
      ? FAMILY_PROVIDERS[getModelFamily(model)]
      : null,
    model.source === 'remote' ? 'From a link' : null,
    model.source === 'local' ? 'From device' : null,
    ...modelSpecParts(model, 'B params'),
  ]
    .filter(Boolean)
    .join(' · ');

const ActionRow = ({ action }: { action: Action }) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const { background, foreground } = {
    accent: { background: theme.bg.accentSoft, foreground: theme.text.accent },
    neutral: { background: theme.bg.tile, foreground: theme.text.primary },
    destructive: {
      background: theme.bg.errorSecondary,
      foreground: theme.text.error,
    },
  }[action.tone];
  const destructive = action.tone === 'destructive';
  const Icon = action.icon;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={action.onPress}
      style={({ pressed }) => [styles.actionRow, pressed && pressedOpacity]}
      testID={`model-sheet-${action.key}`}
    >
      <View style={[styles.actionWell, { backgroundColor: background }]}>
        <Icon
          width={ACTION_ICON_SIZE}
          height={ACTION_ICON_SIZE}
          style={{ color: foreground }}
        />
      </View>
      <Text
        style={[styles.actionLabel, destructive && styles.textError]}
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {action.label}
      </Text>
      {!destructive && (
        <ChevronRightIcon
          width={CHEVRON_WIDTH}
          height={CHEVRON_HEIGHT}
          style={styles.chevron}
        />
      )}
    </Pressable>
  );
};

const ModelManagementSheet = ({ bottomSheetModalRef }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const db = useSQLiteContext();

  const { removeModel } = useModelStore();
  const { deleteModelFiles, ConfirmElement: DeleteFilesConfirm } =
    useDeleteModelFiles();
  const { confirm, ConfirmElement: RemoveModelConfirm } = useConfirm();

  const leaveSheetFor = (navigate: () => void) => {
    bottomSheetModalRef.current?.dismiss();
    if (router.canDismiss()) router.dismissAll();
    navigate();
  };

  const modelActions = (model: Model): Action[] => {
    const usable = model.isDownloaded && isModelCompatible(model);
    const actions: Action[] = [];
    if (usable) {
      actions.push({
        key: 'start-chat',
        label: 'Start a chat',
        icon: ChatIcon,
        tone: 'accent',
        onPress: () =>
          leaveSheetFor(() => startPhantomChat(db, 'replace', model)),
      });
      actions.push({
        key: 'benchmark',
        label: 'Run benchmark',
        icon: BenchmarkIcon,
        tone: 'neutral',
        onPress: () =>
          leaveSheetFor(() => router.replace(`/benchmark?modelId=${model.id}`)),
      });
    }
    if (model.source !== 'built-in') {
      actions.push({
        key: 'edit',
        label: 'Edit model',
        icon: EditIcon,
        tone: 'neutral',
        onPress: () => {
          router.push(
            model.source === 'remote'
              ? `edit-remote-model/${model.id}`
              : `edit-local-model/${model.id}`
          );
          bottomSheetModalRef.current?.dismiss();
        },
      });
    }
    if (model.source !== 'local' && model.isDownloaded) {
      actions.push({
        key: 'delete-files',
        label: 'Delete downloaded files',
        icon: TrashIcon,
        tone: 'destructive',
        onPress: () => {
          bottomSheetModalRef.current?.dismiss();
          deleteModelFiles(model);
        },
      });
    }
    if (model.source !== 'built-in') {
      actions.push({
        key: 'remove',
        label: 'Remove from the app',
        icon: CrossCircleIcon,
        tone: 'destructive',
        onPress: () => {
          bottomSheetModalRef.current?.dismiss();
          removeFromApp(model);
        },
      });
    }
    return actions;
  };

  const removeFromApp = async (model: Model) => {
    const confirmed = await confirm({
      title: 'Remove model from the app?',
      message:
        model.source === 'local'
          ? `${model.modelName} will be removed from the app. The original files on your device will not be touched.`
          : `${model.modelName} and its stored external URLs will be removed. You can add it again manually.`,
      confirmLabel: 'Remove',
    });
    if (!confirmed) return;

    await removeModel(model.id);
    Toast.show({
      type: 'defaultToast',
      text1: `${model.modelName} has been successfully deleted`,
    });
  };

  const renderHeader = (model: Model) => {
    const meta = modelMeta(model);

    return (
      <>
        <ModelRow>
          <ModelFamilyTile family={getModelFamily(model)} size="card" />
          <ModelRowText
            title={model.modelName}
            titleLines={0}
            titleStyle={styles.name}
            titleTestID="model-sheet-name"
            subtitle={meta}
          />
          {model.isDownloaded && <DownloadedBadge size="large" />}
        </ModelRow>
        <ModelCapabilityBadges model={model} showCustom />
      </>
    );
  };

  const renderContent = (model: Model) => {
    const actions = modelActions(model);
    return (
      <>
        {renderHeader(model)}
        {actions.length > 0 && (
          <View style={styles.actionGroup}>
            {actions.map((action, index) => (
              <React.Fragment key={action.key}>
                {index > 0 && <View style={styles.separator} />}
                <ActionRow action={action} />
              </React.Fragment>
            ))}
          </View>
        )}
      </>
    );
  };

  return (
    <>
      <BackDismissibleSheetModal
        ref={bottomSheetModalRef}
        enableDynamicSizing
        onChange={(index) => {
          if (index >= 0) Feedback.sheetOpen();
        }}
      >
        {(props) =>
          props.data ? (
            <BottomSheetView style={styles.container}>
              {renderContent(props.data)}
            </BottomSheetView>
          ) : null
        }
      </BackDismissibleSheetModal>
      {DeleteFilesConfirm}
      {RemoveModelConfirm}
    </>
  );
};

export default ModelManagementSheet;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      paddingTop: space.two,
      paddingHorizontal: space.four,
      paddingBottom: theme.insets.bottom + space.four,
      gap: space.three,
    },
    name: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.lg,
      lineHeight: lineHeights.lg,
      color: theme.text.primary,
    },
    actionGroup: {
      marginTop: space.one,
      borderRadius: radius.twelve,
      borderWidth: stroke.soft,
      borderColor: theme.border.soft,
      overflow: 'hidden',
    },
    separator: {
      height: stroke.soft,
      backgroundColor: theme.border.soft,
    },
    actionRow: {
      minHeight: ACTION_ROW_MIN_HEIGHT,
      paddingVertical: space.two,
      paddingHorizontal: space.three,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
    },
    actionWell: {
      width: ACTION_WELL_SIZE,
      height: ACTION_WELL_SIZE,
      borderRadius: ACTION_WELL_RADIUS,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      flex: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    chevron: {
      color: theme.text.primary,
      opacity: CHEVRON_OPACITY,
    },
    textError: {
      color: theme.text.error,
    },
  });
