import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { MODEL_UPDATE_TEXT } from '../../constants/model-update';
import { type Model } from '../../database/modelRepository';
import { ModelState, useModelStore } from '../../store/modelStore';
import { pressedOpacity } from '../../styles/pressable';
import { useModelUpdate } from '../../hooks/useModelUpdate';
import { Glass } from '../Glass';
import { COMPOSER, COMPOSER_CARD_RADIUS } from './attachments/constants';
import ChooseModelPill, { CHOOSE_MODEL_LABEL } from './ChooseModelPill';

interface Props {
  model: Model;
  replaces?: string;
  floating?: boolean;
  onChooseModel?: () => void;
}

const ModelUpdateBanner = ({
  model,
  replaces,
  floating = false,
  onChooseModel,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const download = useModelStore((state) => state.downloadStates[model.id]);
  const updating = download?.status === ModelState.Downloading;
  const { updateModel, downloadReplacement, ConfirmElement } = useModelUpdate();

  const handleUpdate = () =>
    replaces ? downloadReplacement(model) : updateModel(model);

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
      radius={floating ? radius.eighteen : COMPOSER_CARD_RADIUS}
      interactive={false}
      tint={floating ? theme.bg.toastGlassTint : undefined}
      fallbackTint={floating ? theme.bg.toast : theme.bg.chatBar}
      style={[
        styles.banner,
        floating ? styles.floating : styles.docked,
        onChooseModel && styles.stacked,
      ]}
      testID="model-update-banner"
    >
      <Text
        style={[
          styles.text,
          !floating && styles.dockedText,
          onChooseModel && styles.stackedText,
        ]}
      >
        {message()}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={handleUpdate}
          disabled={updating}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && pressedOpacity]}
          testID="model-update-banner-action"
        >
          <Text style={styles.actionText}>{actionLabel()}</Text>
        </Pressable>
        {onChooseModel && (
          <Pressable
            onPress={onChooseModel}
            accessibilityRole="button"
            accessibilityLabel={CHOOSE_MODEL_LABEL}
            style={({ pressed }) => [styles.choose, pressed && pressedOpacity]}
            testID="model-update-banner-choose"
          >
            <ChooseModelPill />
          </Pressable>
        )}
      </View>
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
    stacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
    },
    stackedText: {
      flex: 0,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: space.two,
    },
    choose: {
      flexShrink: 1,
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
