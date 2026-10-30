import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Model } from '../../database/modelRepository';
import {
  radius,
  space,
  stroke,
  textStyles,
} from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import { composerControlSurface } from './composerControl';
import { COMPOSER } from './attachments/constants';
import {
  BADGE_HEIGHT,
  CHEVRON_HEIGHT,
  CHEVRON_OPACITY,
  CHEVRON_WIDTH,
  LOADER_SCALE,
} from './ComposerModelBadge';
import ModelsIcon from '../../assets/icons/models.svg';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

const MODELS_ICON_SIZE = 14;

const unavailableMessage = (model?: Model) =>
  `${model?.modelName ?? "This chat's model"} isn't on this device anymore`;

interface Props {
  model?: Model;
  pendingModel?: Model;
  onPress: () => void;
}

const ModelUnavailableCard = ({ model, pendingModel, onPress }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const message = unavailableMessage(model);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && pressedOpacity]}
      onPress={onPress}
      disabled={!!pendingModel}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!pendingModel, busy: !!pendingModel }}
      accessibilityLabel={
        pendingModel
          ? `${message}. Loading ${pendingModel.modelName}`
          : `${message}. Choose a model`
      }
      testID="model-unavailable-card"
    >
      <Text style={styles.message}>{message}</Text>
      {pendingModel ? (
        <View style={styles.pill}>
          <ModelFamilyTile
            family={getModelFamily(pendingModel)}
            size="badge"
            iconColor={theme.text.onChatBar}
          />
          <Text
            style={styles.pillLabel}
            numberOfLines={1}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            {pendingModel.modelName}
          </Text>
          <ActivityIndicator
            size="small"
            color={theme.text.onChatBar}
            style={styles.loader}
            testID="model-unavailable-card-loader"
          />
        </View>
      ) : (
        <View style={[styles.pill, styles.choosePill]}>
          <ModelsIcon
            width={MODELS_ICON_SIZE}
            height={MODELS_ICON_SIZE}
            style={styles.icon}
          />
          <Text
            style={styles.pillLabel}
            numberOfLines={1}
            maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
          >
            Choose a model
          </Text>
          <ChevronDownIcon
            width={CHEVRON_WIDTH}
            height={CHEVRON_HEIGHT}
            style={styles.chevron}
          />
        </View>
      )}
    </Pressable>
  );
};

export default ModelUnavailableCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      gap: space.three,
      padding: COMPOSER.cardPadding,
      backgroundColor: theme.bg.chatBar,
      borderWidth: stroke.soft,
      borderColor: theme.border.chatBar,
      borderRadius: radius.eighteen,
    },
    message: {
      ...textStyles.bodySecondaryRegular,
      color: theme.text.onChatBarMuted,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexShrink: 1,
      minHeight: BADGE_HEIGHT,
      gap: space.one + space.half,
      paddingLeft: space.one + space.half,
      paddingRight: space.twoHalf,
      borderRadius: radius.full,
      ...composerControlSurface(theme),
    },
    choosePill: {
      paddingLeft: space.twoHalf,
    },
    icon: {
      color: theme.text.onChatBar,
    },
    pillLabel: {
      flexShrink: 1,
      ...textStyles.bodySecondaryMedium,
      color: theme.text.onChatBar,
    },
    loader: {
      transform: [{ scale: LOADER_SCALE }],
    },
    chevron: {
      color: theme.text.onChatBar,
      opacity: CHEVRON_OPACITY,
    },
  });
