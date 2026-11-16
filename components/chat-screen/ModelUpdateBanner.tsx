import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { type Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { pressedOpacity } from '../../styles/pressable';
import { useUpdateNetworkCheck } from '../../hooks/useUpdateNetworkCheck';
import { Glass } from '../Glass';
import { COMPOSER, COMPOSER_CARD_RADIUS } from './attachments/constants';

interface Props {
  model: Model;
  replaces?: string;
}

const ModelUpdateBanner = ({ model, replaces }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
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
    <Glass
      radius={replaces ? COMPOSER_CARD_RADIUS : radius.eighteen}
      interactive={false}
      tint={replaces ? undefined : theme.bg.toastGlassTint}
      fallbackTint={replaces ? theme.bg.chatBar : theme.bg.toast}
      style={[styles.banner, replaces ? styles.docked : styles.floating]}
      testID="model-update-banner"
    >
      <Text style={[styles.text, replaces && styles.dockedText]}>
        {message()}
      </Text>
      <Pressable
        onPress={handleUpdate}
        disabled={updating}
        accessibilityRole="button"
        style={({ pressed }) => [styles.action, pressed && pressedOpacity]}
      >
        <Text style={styles.actionText}>{actionLabel()}</Text>
      </Pressable>
      {ConfirmElement}
    </Glass>
  );
};

export default ModelUpdateBanner;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
    },
    docked: {
      padding: COMPOSER.cardPadding,
    },
    floating: {
      width: '90%',
      padding: space.four,
    },
    text: {
      flex: 1,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.primary,
    },
    dockedText: {
      color: theme.text.onChatBar,
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
