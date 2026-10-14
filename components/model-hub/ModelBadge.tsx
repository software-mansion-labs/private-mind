import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { radius, space } from '../../constants/design-system';
import { SvgComponent } from '../../utils/SvgComponent';

export type ModelBadgeTone = 'neutral' | 'error';

interface Props {
  label: string;
  icon?: SvgComponent;
  tone?: ModelBadgeTone;
}

const BADGE_HEIGHT = 24;
const BADGE_ICON_SIZE = 14;

const ModelBadge = ({ label, icon: Icon, tone = 'neutral' }: Props) => {
  const { styles } = useThemedStyles(createStyles, tone);

  return (
    <View style={styles.badge} testID={`model-badge-${label}`}>
      {Icon && (
        <Icon
          width={BADGE_ICON_SIZE}
          height={BADGE_ICON_SIZE}
          style={styles.icon}
        />
      )}
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

export default ModelBadge;

const createStyles = (theme: Theme, tone: ModelBadgeTone) => {
  const foreground =
    tone === 'error' ? theme.text.error : theme.text.defaultSecondary;
  return StyleSheet.create({
    badge: {
      height: BADGE_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: space.one,
      paddingHorizontal: space.two,
      borderRadius: radius.full,
      backgroundColor:
        tone === 'error' ? theme.bg.errorSecondary : theme.bg.tile,
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
