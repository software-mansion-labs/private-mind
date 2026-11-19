import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { pressedOpacity } from '../../styles/pressable';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { radius, rowChevron, space } from '../../constants/design-system';
import { type SwmModelRole } from '../../constants/family-descriptions';
import {
  ATTRIBUTION_CARD_HINT,
  SWM_ROLE_TITLES,
} from '../../constants/model-attribution';
import SwmLogo from '../../assets/icons/swm-logo.svg';
import ChevronRightIcon from '../../assets/icons/chevron-right.svg';

const LOGO_WIDTH = 40;
const LOGO_HEIGHT = 22;
const CHEVRON_OPACITY = 0.5;

interface Props {
  role: SwmModelRole;
  provider: string;
  onPress: () => void;
}

const SwmAttributionCard = ({ role, provider, onPress }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const title = SWM_ROLE_TITLES[role];
  const subtitle = `Original model by ${provider}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${subtitle}`}
      accessibilityHint={ATTRIBUTION_CARD_HINT}
      style={({ pressed }) => [styles.card, pressed && pressedOpacity]}
      testID="swm-attribution-card"
    >
      <SwmLogo
        width={LOGO_WIDTH}
        height={LOGO_HEIGHT}
        style={{ color: theme.text.primary }}
      />
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      <ChevronRightIcon
        width={rowChevron.width}
        height={rowChevron.height}
        style={styles.chevron}
      />
    </Pressable>
  );
};

export default SwmAttributionCard;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.three,
      padding: space.three,
      borderRadius: radius.eighteen,
      backgroundColor: theme.bg.softTertiary,
    },
    text: {
      flex: 1,
      gap: space.half,
    },
    title: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
    subtitle: {
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      lineHeight: lineHeights.sm,
      color: theme.text.defaultTertiary,
    },
    chevron: {
      color: theme.text.primary,
      opacity: CHEVRON_OPACITY,
    },
  });
