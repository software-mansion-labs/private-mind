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
  icon?: React.ReactNode;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const SecondaryButton = ({
  text,
  onPress,
  icon,
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
      {icon}
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </TouchableOpacity>
  );
};

export default SecondaryButton;

const createStyles = (theme: Theme, disabled: boolean) =>
  StyleSheet.create({
    button: {
      height: 48,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: 12,
      borderColor: theme.bg.strongPrimary,
      opacity: disabled ? 0.4 : 1,
      flexDirection: 'row',
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
  });
