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
import { radius, space, textStyles } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { getModelFamily } from '../../utils/modelFamily';
import ModelFamilyTile from '../model-hub/ModelFamilyTile';
import { composerControlSurface } from './composerControl';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

export const BADGE_HEIGHT = 32;
const BADGE_MAX_WIDTH = 220;
export const CHEVRON_WIDTH = 10;
export const CHEVRON_HEIGHT = 6;
const ACCESSORY_SIZE = 14;
export const LOADER_SCALE = 0.65;
export const CHEVRON_OPACITY = 0.7;

interface Props {
  model: Model;
  onPress: () => void;
  locked?: boolean;
  loading?: boolean;
}

const ComposerModelBadge = ({
  model,
  onPress,
  locked = false,
  loading = false,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <Pressable
      style={({ pressed }) => [styles.badge, pressed && pressedOpacity]}
      onPress={onPress}
      disabled={locked || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked || loading, busy: loading }}
      accessibilityLabel={
        loading
          ? `Model: ${model.modelName}. Loading`
          : locked
            ? `Model: ${model.modelName}`
            : `Model: ${model.modelName}. Change model`
      }
      testID="composer-model-badge"
    >
      <ModelFamilyTile
        family={getModelFamily(model)}
        size="badge"
        iconColor={theme.text.onChatBar}
      />
      <Text
        style={styles.name}
        numberOfLines={1}
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {model.modelName}
      </Text>
      {loading ? (
        <View style={styles.accessory}>
          <ActivityIndicator
            size="small"
            color={styles.name.color}
            style={styles.loader}
            testID="composer-model-badge-loader"
          />
        </View>
      ) : locked ? null : (
        <ChevronDownIcon
          width={CHEVRON_WIDTH}
          height={CHEVRON_HEIGHT}
          style={styles.chevron}
        />
      )}
    </Pressable>
  );
};

export default ComposerModelBadge;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      flexShrink: 1,
      minHeight: BADGE_HEIGHT,
      maxWidth: BADGE_MAX_WIDTH,
      gap: space.one + space.half,
      paddingLeft: space.one + space.half,
      paddingRight: space.twoHalf,
      borderRadius: radius.full,
      ...composerControlSurface(theme),
    },
    name: {
      flexShrink: 1,
      ...textStyles.bodySecondaryMedium,
      color: theme.text.onChatBar,
    },
    accessory: {
      width: ACCESSORY_SIZE,
      height: ACCESSORY_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loader: {
      transform: [{ scale: LOADER_SCALE }],
    },
    chevron: {
      color: theme.text.onChatBar,
      opacity: CHEVRON_OPACITY,
    },
  });
