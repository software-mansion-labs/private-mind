import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { radius, space, textStyles } from '../../constants/design-system';
import { CAPPED_TEXT_MAX_SCALE } from '../../constants/font-scale';
import { Theme } from '../../styles/colors';
import { composerControlSurface } from './composerControl';
import {
  BADGE_HEIGHT,
  CHEVRON_HEIGHT,
  CHEVRON_OPACITY,
  CHEVRON_WIDTH,
} from './ComposerModelBadge';
import ModelsIcon from '../../assets/icons/models.svg';
import ChevronDownIcon from '../../assets/icons/chevron-down.svg';

const MODELS_ICON_SIZE = 14;

export const CHOOSE_MODEL_LABEL = 'Choose a model';

const ChooseModelPill = () => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.pill}>
      <ModelsIcon
        width={MODELS_ICON_SIZE}
        height={MODELS_ICON_SIZE}
        style={styles.icon}
      />
      <Text
        style={styles.label}
        numberOfLines={1}
        maxFontSizeMultiplier={CAPPED_TEXT_MAX_SCALE}
      >
        {CHOOSE_MODEL_LABEL}
      </Text>
      <ChevronDownIcon
        width={CHEVRON_WIDTH}
        height={CHEVRON_HEIGHT}
        style={styles.chevron}
      />
    </View>
  );
};

export default ChooseModelPill;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexShrink: 1,
      minHeight: BADGE_HEIGHT,
      gap: space.one + space.half,
      paddingHorizontal: space.twoHalf,
      borderRadius: radius.full,
      ...composerControlSurface(theme),
    },
    icon: {
      color: theme.text.onChatBar,
    },
    label: {
      flexShrink: 1,
      ...textStyles.bodySecondaryMedium,
      color: theme.text.onChatBar,
    },
    chevron: {
      color: theme.text.onChatBar,
      opacity: CHEVRON_OPACITY,
    },
  });
