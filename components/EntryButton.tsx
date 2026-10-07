import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../styles/fontStyles';
import { Theme } from '../styles/colors';
import { controlHeight, opacity, radius } from '../constants/design-system';

interface Props {
  text: string;
  icon?: React.ReactNode;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const EntryButton = ({
  text,
  icon,
  onPress,
  disabled = false,
  style,
  textStyle,
}: Props) => {
  const { styles } = useThemedStyles(createStyles);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={opacity.pressed}
      style={[styles.button, style]}
    >
      {icon}
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
};

export default EntryButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      height: controlHeight.button,
      paddingVertical: 8,
      paddingHorizontal: 12,
      gap: 12,
      alignItems: 'center',
      borderRadius: radius.twelve,
      width: '100%',
      flexDirection: 'row',
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.primary,
    },
  });
