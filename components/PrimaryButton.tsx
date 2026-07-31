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
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { Theme } from '../styles/colors';

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
      height: 48,
      width: '100%',
      borderRadius: 12,
      paddingHorizontal: 10,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.bg.main,
      opacity: disabled ? 0.4 : 1,
      flexDirection: 'row',
      gap: 2,
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.contrastPrimary,
    },
  });
