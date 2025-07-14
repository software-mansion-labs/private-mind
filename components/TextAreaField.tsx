import React, { useMemo, useState } from 'react';
import { TextInput, StyleSheet, View, TextInputProps } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontFamily';
import { Theme } from '../styles/colors';

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
  const styles = useMemo(() => createStyles(theme, active), [theme, active]);

  return (
    <View style={styles.inputWrapper}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text.defaultTertiary}
        multiline
        textAlignVertical="top"
        style={styles.textArea}
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

export default TextAreaField;

const createStyles = (theme: Theme, active: boolean) =>
  StyleSheet.create({
    inputWrapper: {
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderWidth: active ? 2 : 1,
      borderColor: active ? theme.bg.strongPrimary : theme.border.soft,
    },
    textArea: {
      height: 120,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
  });
