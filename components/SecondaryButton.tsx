// components/ReusableButton.tsx
import React from 'react';
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

interface Props {
  text: string;
  onPress: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const SecondaryButton = ({
  text,
  onPress,
  disabled = false,
  style,
  textStyle,
}: Props) => {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          borderColor: theme.bg.strongPrimary,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: theme.text.primary }, textStyle]}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    height: 40,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 4,
  },
  text: {
    fontFamily: fontFamily.medium,
    fontSize: fontSizes.sm,
  },
});

export default SecondaryButton;
