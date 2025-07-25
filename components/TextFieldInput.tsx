import React, { useMemo, useState } from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { Theme } from '../styles/colors';
import TextInputBorder from './TextInputBorder';

type TextFieldInputProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  icon?: React.ReactNode;
  onFocus?: () => void;
};

const TextFieldInput: React.FC<TextFieldInputProps> = ({
  value,
  onChangeText,
  icon,
  onFocus,
  placeholder,
  ...props
}) => {
  const { theme } = useTheme();
  const [active, setActive] = useState(false);

  const styles = useMemo(
    () => createStyles(theme, !!icon, props.editable !== false),
    [theme, icon, props.editable]
  );

  return (
    <View style={styles.inputWrapper}>
      <TextInputBorder active={active} />
      {icon}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
        style={styles.input}
        onFocus={() => {
          setActive(true);
          onFocus?.();
        }}
        onBlur={() => setActive(false)}
        {...props}
      />
    </View>
  );
};

export default TextFieldInput;

const createStyles = (
  theme: Theme,
  hasIcon: boolean,
  isEditable: boolean = true
) =>
  StyleSheet.create({
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    input: {
      width: hasIcon ? '90%' : '100%',
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
      opacity: isEditable ? 1 : 0.4,
      lineHeight: 22,
    },
  });
