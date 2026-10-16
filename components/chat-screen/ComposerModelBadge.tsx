import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Model } from '../../database/modelRepository';
import { getModelFamily } from '../../utils/modelFamily';
import {
  familyIcon,
  familyInitial,
  UNKNOWN_FAMILY_COLOR,
} from '../../constants/model-families';
import { radius, space, stroke } from '../../constants/design-system';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

const BADGE_HEIGHT = 32;
const BADGE_MAX_WIDTH = 220;
const TILE_SIZE = 20;
const TILE_ICON_SIZE = 12;
const CHEVRON_WIDTH = 10;
const CHEVRON_HEIGHT = 6;
const ACCESSORY_SIZE = 14;
const LOADER_SCALE = 0.65;

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
  const { styles } = useThemedStyles(createStyles);
  const family = getModelFamily(model);
  const FamilyIcon = familyIcon(family);

  return (
    <TouchableOpacity
      style={styles.badge}
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
      <View
        style={[styles.tile, !FamilyIcon && styles.initialTile]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {FamilyIcon ? (
          <FamilyIcon
            width={TILE_ICON_SIZE}
            height={TILE_ICON_SIZE}
            style={styles.tileIcon}
          />
        ) : (
          <Text style={styles.tileInitial}>{familyInitial(family)}</Text>
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
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
    </TouchableOpacity>
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
      height: BADGE_HEIGHT,
      maxWidth: BADGE_MAX_WIDTH,
      gap: space.one + space.half,
      paddingLeft: space.one + space.half,
      paddingRight: space.twoHalf,
      borderRadius: radius.full,
      borderWidth: stroke.soft,
      borderColor: theme.border.chatBar,
      backgroundColor: theme.bg.chatBarBadge,
    },
    tile: {
      width: TILE_SIZE,
      height: TILE_SIZE,
      borderRadius: radius.six,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.tile,
    },
    tileIcon: {
      color: theme.text.onChatBar,
    },
    initialTile: {
      backgroundColor: theme.label[UNKNOWN_FAMILY_COLOR].background,
    },
    tileInitial: {
      fontFamily: fontFamily.bold,
      fontSize: fontSizes.xxs,
      lineHeight: lineHeights.xxs,
      color: theme.label[UNKNOWN_FAMILY_COLOR].foreground,
    },
    name: {
      flexShrink: 1,
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
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
      opacity: 0.7,
    },
  });
