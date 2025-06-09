import React from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

type TextAreaFieldProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  ...props
}) => {
  const { theme } = useTheme();

  return (
    <View style={{ ...styles.inputWrapper, borderColor: theme.border.soft }}>
      <TextInput
        style={{ ...styles.textArea, color: theme.text.primary }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
        multiline
        textAlignVertical="top"
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
  textArea: {
    height: 120,
    fontFamily: fontFamily.regular,
    fontSize: fontSizes.sm,
  },
});

export default TextAreaField;
