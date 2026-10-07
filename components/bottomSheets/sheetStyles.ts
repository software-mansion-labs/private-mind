import { StyleSheet } from 'react-native';
import { Theme } from '../../styles/colors';
import { radius } from '../../constants/design-system';

export const createSheetStyles = (theme: Theme) =>
  StyleSheet.create({
    background: {
      backgroundColor: theme.bg.softPrimary,
      borderTopLeftRadius: radius.eighteen,
      borderTopRightRadius: radius.eighteen,
    },
    handle: {
      backgroundColor: theme.bg.softPrimary,
      borderTopLeftRadius: radius.eighteen,
      borderTopRightRadius: radius.eighteen,
    },
    handleIndicator: {
      width: 64,
      height: 4,
      borderRadius: radius.full,
      backgroundColor: theme.text.primary,
    },
  });
