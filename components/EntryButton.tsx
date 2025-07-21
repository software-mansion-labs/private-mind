import React, { useMemo } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  GestureResponderEvent,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { Theme } from '../styles/colors';

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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, style]}
    >
      {icon && <View>{icon}</View>}
      <Text style={[styles.text, textStyle]}>{text}</Text>
    </TouchableOpacity>
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
