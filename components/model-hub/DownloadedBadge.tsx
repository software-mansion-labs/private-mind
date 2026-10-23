import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';
import CheckIcon from '../../assets/icons/check.svg';

const CHECK_BADGE_SIZE = 16;
const CHECK_ICON_SIZE = 10;

interface Props {
  testID?: string;
}

const DownloadedBadge = ({ testID }: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);

  return (
    <View
      style={styles.badge}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Downloaded"
      testID={testID}
    >
      <CheckIcon
        width={CHECK_ICON_SIZE}
        height={CHECK_ICON_SIZE}
        color={theme.text.onSuccess}
      />
    </View>
  );
};

export default DownloadedBadge;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      width: CHECK_BADGE_SIZE,
      height: CHECK_BADGE_SIZE,
      borderRadius: radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.bg.success,
    },
  });
