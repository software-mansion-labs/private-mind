import React from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
} from 'react-native';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { Theme } from '../styles/colors';
import { pressedOpacity } from '../styles/pressable';

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
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, style, pressed && pressedOpacity]}
    >
      {icon}
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </Pressable>
  );
};

export default EntryButton;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    button: {
      height: 40,
      paddingVertical: 8,
      paddingHorizontal: 12,
      gap: 12,
      alignItems: 'center',
      borderRadius: 4,
      width: '100%',
      flexDirection: 'row',
    },
    text: {
      fontFamily: fontFamily.medium,
      fontSize: fontSizes.md,
      color: theme.text.primary,
    },
  });
