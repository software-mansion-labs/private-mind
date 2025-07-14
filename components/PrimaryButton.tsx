import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { Theme } from '../styles/colors';

interface Props {
  text: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const PrimaryButton = ({
  text,
  onPress,
  disabled = false,
  style,
  textStyle,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(
    () => createStyles(theme, disabled),
    [theme, disabled]
  );

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, style]}
    >
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
};

export default PrimaryButton;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    button: {
      height: 48,
      width: '100%',
      borderRadius: 12,
      paddingHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
      opacity: disabled ? 0.4 : 1,
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.contrastPrimary,
    },
  });
