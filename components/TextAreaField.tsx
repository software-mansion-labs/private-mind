import React, { useState } from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

type TextAreaFieldProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  onFocus,
  ...props
}) => {
  const { theme } = useTheme();
  const [active, setActive] = useState(false);

  return (
    <View
      style={{
        ...styles.inputWrapper,
        borderColor: active ? theme.bg.strongPrimary : theme.border.soft,
        borderWidth: active ? 2 : 1,
      }}
    >
      <TextInput
        style={{ ...styles.textArea, color: theme.text.primary }}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
        multiline
        textAlignVertical="top"
        onFocus={() => {
          onFocus?.();
          setActive(true);
        }}
        onBlur={() => setActive(false)}
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inputWrapper: {
    borderRadius: 12,
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
