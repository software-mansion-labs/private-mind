import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';
import CheckIcon from '../../assets/icons/check.svg';

const BADGE_SIZE = {
  small: { badge: 16, icon: 10 },
  medium: { badge: 20, icon: 12 },
  large: { badge: 32, icon: 16 },
} as const;

export type DownloadedBadgeSize = keyof typeof BADGE_SIZE;

interface Props {
  size?: DownloadedBadgeSize;
  testID?: string;
}

const DownloadedBadge = ({ size = 'small', testID }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles, size);
  const iconSize = BADGE_SIZE[size].icon;

  return (
    <View
      style={styles.badge}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Downloaded"
      testID={testID}
    >
      <CheckIcon
        width={iconSize}
        height={iconSize}
        color={theme.text.onSuccess}
      />
    </View>
  );
};

export default DownloadedBadge;

const createStyles = (theme: Theme, size: DownloadedBadgeSize) =>
  StyleSheet.create({
    badge: {
      width: BADGE_SIZE[size].badge,
      height: BADGE_SIZE[size].badge,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.success,
    },
  });
