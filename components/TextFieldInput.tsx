import React, { useState } from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';

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

  return (
    <View
      style={{
        ...styles.inputWrapper,
        borderColor: active ? theme.bg.strongPrimary : theme.border.soft,
        borderWidth: active ? 2 : 1,
      }}
    >
      {icon}
      <TextInput
        style={
          icon
            ? {
                ...styles.input,
                color: theme.text.primary,
                opacity: props.editable !== false ? 1 : 0.4,
              }
            : {
                ...styles.input,
                color: theme.text.primary,
                width: '100%',
                opacity: props.editable !== false ? 1 : 0.4,
              }
        }
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
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
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    fontSize: fontSizes.md,
    fontFamily: fontFamily.regular,
    width: '90%',
    lineHeight: 22,
  },
});

export default TextFieldInput;
