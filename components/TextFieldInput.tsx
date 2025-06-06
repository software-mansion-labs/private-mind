import React from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

type TextFieldInputProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
};

const TextFieldInput: React.FC<TextFieldInputProps> = ({
  value,
  onChangeText,
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
  },
  input: {
    fontSize: fontSizes.fontSizeMd,
    fontFamily: fontFamily.regular,
  },
});

export default TextFieldInput;
