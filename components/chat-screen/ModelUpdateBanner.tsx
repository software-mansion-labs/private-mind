import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space, stroke } from '../../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { type Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { pressedOpacity } from '../../styles/pressable';
import { useUpdateNetworkCheck } from '../../hooks/useUpdateNetworkCheck';

interface Props {
  model: Model;
  replaces?: string;
}

const ModelUpdateBanner = ({ model, replaces }: Props) => {
  const { styles } = useThemedStyles(createStyles);
  const download = useModelStore((state) => state.downloadStates[model.id]);
  const updateOutdatedModel = useModelStore(
    (state) => state.updateOutdatedModel
  );
  const downloadModel = useModelStore((state) => state.downloadModel);
  const updating = download?.status === ModelState.Downloading;
  const { canDownload, ConfirmElement } = useUpdateNetworkCheck();

  const handleUpdate = async () => {
    const network = await canDownload(model.modelSize ?? 0);
    if (!network) return;
    await useModelStore
      .getState()
      .rememberUpdateConsent([model.modelName], network === 'mobile-data');
    if (replaces) downloadModel(model);
    else updateOutdatedModel(model);
  };

  const message = () => {
    if (replaces)
      return MODEL_UPDATE_TEXT.replacementBanner(replaces, model.modelName);
    if (model.updateRequired)
      return MODEL_UPDATE_TEXT.chatBanner(model.modelName);
    return MODEL_UPDATE_TEXT.newerVersionBanner(model.modelName);
  };

  const actionLabel = () => {
    if (updating) return `${Math.round(download.progress * 100)}%`;
    if (replaces) return MODEL_UPDATE_TEXT.replacementBannerAction;
    return MODEL_UPDATE_TEXT.chatBannerAction;
  };

  return (
    <View
      style={[styles.banner, !replaces && styles.floating]}
      testID="model-update-banner"
    >
      <Text style={styles.text}>{message()}</Text>
      <Pressable
        onPress={handleUpdate}
        disabled={updating}
        accessibilityRole="button"
        style={({ pressed }) => [styles.action, pressed && pressedOpacity]}
      >
        <Text style={styles.actionText}>{actionLabel()}</Text>
      </Pressable>
      {ConfirmElement}
    </View>
  );
};

export default ModelUpdateBanner;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: space.three,
      borderRadius: radius.twelve,
      backgroundColor: theme.bg.softTertiary,
    },
    floating: {
      width: '90%',
      padding: space.four,
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.toast,
      borderWidth: stroke.soft,
      borderColor: theme.border.toast,
      shadowColor: theme.bg.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.shadow.floatingOpacity,
      shadowRadius: 20,
      elevation: 12,
    },
    text: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    action: {
      paddingVertical: space.two,
      paddingHorizontal: space.three,
      borderRadius: radius.full,
      backgroundColor: theme.bg.main,
    },
    actionText: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.onBrand,
    },
  });
