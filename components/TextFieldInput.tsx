import React from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

type TextFieldInputProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  icon?: React.ReactNode;
};

const TextFieldInput: React.FC<TextFieldInputProps> = ({
  value,
  onChangeText,
  icon,
  placeholder,
  ...props
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={{
        ...styles.inputWrapper,
        borderColor: theme.border.soft,
      }}
    >
      {icon}
      <TextInput
        style={{ ...styles.input, color: theme.text.primary }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.regular,
    width: '90%',
  },
});

export default TextFieldInput;
