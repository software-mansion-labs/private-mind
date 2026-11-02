import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import {
  LabelColor,
  labelColor,
  labelIcon,
} from '../../constants/model-labels';

export type ModelBadgeColor = LabelColor | 'error' | 'neutral';

interface Props {
  label: string;
  color?: ModelBadgeColor;
}

const BADGE_HEIGHT = 24;
const BADGE_ICON_SIZE = 14;

const ModelBadge = ({ label, color = labelColor(label) }: Props) => {
  const { styles } = useThemedStyles(createStyles, color);
  const Icon = labelIcon(label);

  return (
    <View style={styles.badge} testID={`model-badge-${label}`}>
      {Icon && (
        <Icon
          width={BADGE_ICON_SIZE}
          height={BADGE_ICON_SIZE}
          style={styles.icon}
        />
      )}
      <Text style={styles.label} maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}>
        {label}
      </Text>
    </View>
  );
};

export default ModelBadge;

const createStyles = (theme: Theme, color: ModelBadgeColor) => {
  const { background, foreground } =
    color === 'error'
      ? { background: theme.bg.errorSecondary, foreground: theme.text.error }
      : color === 'neutral'
        ? { background: theme.bg.tile, foreground: theme.text.defaultSecondary }
        : theme.label[color];
  return StyleSheet.create({
    badge: {
      minHeight: BADGE_HEIGHT,
      paddingVertical: space.half,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.one,
      paddingHorizontal: space.two,
      borderRadius: radius.full,
      backgroundColor: background,
    },
    icon: {
      color: foreground,
    },
    label: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.xs,
      color: foreground,
    },
  });
};
