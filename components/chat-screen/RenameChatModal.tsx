import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { Theme } from '../../styles/colors';

interface Props {
  visible: boolean;
  initialTitle: string;
  onCancel: () => void;
  onSubmit: (newTitle: string) => void;
}

const MAX_TITLE_LENGTH = 25;

const stripTrailingEllipsis = (title: string) =>
  title.endsWith('...') ? title.slice(0, -3) : title;

const RenameChatModal = ({ visible, initialTitle, onCancel, onSubmit }: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [value, setValue] = useState(stripTrailingEllipsis(initialTitle));

  useEffect(() => {
    if (visible) {
      setValue(stripTrailingEllipsis(initialTitle));
    }
  }, [visible, initialTitle]);

  const trimmed = value.trim();
  const canSave = trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit(trimmed);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>Rename chat</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            maxLength={MAX_TITLE_LENGTH}
            autoFocus
            selectTextOnFocus
            placeholder="Chat name"
            placeholderTextColor={theme.text.defaultTertiary}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.buttonRow}>
            <Pressable onPress={onCancel} style={styles.button} hitSlop={8}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              style={styles.button}
              disabled={!canSave}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.buttonText,
                  styles.buttonTextPrimary,
                  !canSave && styles.buttonTextDisabled,
                ]}
              >
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default RenameChatModal;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: theme.bg.softPrimary,
      borderRadius: 16,
      padding: 20,
      gap: 16,
    },
    title: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
    },
    input: {
      borderWidth: 1,
      borderColor: theme.bg.softSecondary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
    },
    buttonRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 16,
    },
    button: {
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    buttonText: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.defaultSecondary,
    },
    buttonTextPrimary: {
      color: theme.text.primary,
    },
    buttonTextDisabled: {
      color: theme.text.defaultTertiary,
    },
  });
