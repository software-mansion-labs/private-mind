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
  onPress: (event: GestureResponderEvent) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const PrimaryButton = ({
  text,
  onPress,
  icon,
  disabled = false,
  style,
  textStyle,
}: Props) => {
  const { styles } = useThemedStyles(createStyles, disabled);

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

export default PrimaryButton;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    button: {
      height: controlHeight.button,
      width: '100%',
      borderRadius: radius.twelve,
      paddingHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
      opacity: disabled ? opacity.disabled : 1,
      flexDirection: 'row',
      gap: 2,
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      color: theme.text.contrastPrimary,
    },
  });
