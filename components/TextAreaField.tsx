import React, { useMemo, useState } from 'react';
import {
  TextInput,
  StyleSheet,
  View,
  Text,
  TextInputProps,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { fontFamily, fontSizes } from '../styles/fontStyles';
import { Theme } from '../styles/colors';
import TextInputBorder from './TextInputBorder';

type TextAreaFieldProps = TextInputProps & {
  value: string;
  onChangeText: (text: string) => void;
  onFocus?: () => void;
  error?: boolean;
  errorMessage?: string;
};

const TextAreaField: React.FC<TextAreaFieldProps> = ({
  value,
  onChangeText,
  placeholder,
  onFocus,
  error = false,
  errorMessage,
  ...props
}) => {
  const { theme } = useTheme();
  const [active, setActive] = useState(false);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        <TextInputBorder active={active} error={error} />
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
      {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
};

export default TextAreaField;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      gap: 8,
    },
    inputWrapper: {
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    textArea: {
      height: 120,
      fontFamily: fontFamily.regular,
      fontSize: fontSizes.sm,
      color: theme.text.primary,
    },
    error: {
      fontSize: fontSizes.sm,
      fontFamily: fontFamily.regular,
      color: theme.text.error,
    },
  });
