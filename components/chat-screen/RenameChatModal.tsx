import React, { PropsWithChildren, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { TEXT_SELECTION, Theme } from '../../styles/colors';
import { MAX_CHAT_TITLE_LENGTH } from '../../utils/chatLabel';
import { useKeyboardOwnerStore } from '../../store/keyboardOwnerStore';
import SecondaryButton from '../SecondaryButton';

type CardProps = PropsWithChildren<{ style: StyleProp<ViewStyle> }>;

const Card = ({ style, children }: CardProps) => {
  if (Platform.OS !== 'ios') return <View style={style}>{children}</View>;
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView style={style} glassEffectStyle="regular">
        {children}
      </GlassView>
    );
  }
  return (
    <BlurView tint="systemThickMaterial" intensity={100} style={style}>
      {children}
    </BlurView>
  );
};

interface Props {
  visible: boolean;
  initialTitle: string;
  onCancel: () => void;
  onSubmit: (newTitle: string) => void;
}

const RenameChatModal = ({
  visible,
  initialTitle,
  onCancel,
  onSubmit,
}: Props) => {
  const { styles, theme } = useThemedStyles(createStyles);
  const [value, setValue] = useState(initialTitle);

  useEffect(() => {
    if (visible) {
      setValue(initialTitle);
    }
  }, [visible, initialTitle]);

  const setModalOwnsKeyboard = useKeyboardOwnerStore(
    (state) => state.setModalOwnsKeyboard
  );
  useEffect(() => {
    setModalOwnsKeyboard(visible);
    return () => setModalOwnsKeyboard(false);
  }, [visible, setModalOwnsKeyboard]);

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
      <KeyboardAvoidingView behavior="padding" style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <Card style={styles.card}>
          <Text style={styles.title}>Rename chat</Text>
          <TextInput
            {...TEXT_SELECTION}
            value={value}
            onChangeText={setValue}
            maxLength={MAX_CHAT_TITLE_LENGTH}
            autoFocus
            selectTextOnFocus
            placeholder="Chat name"
            placeholderTextColor={theme.text.defaultTertiary}
            style={styles.input}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.buttonRow}>
            <SecondaryButton
              text="Cancel"
              onPress={onCancel}
              style={styles.actionButton}
              textStyle={styles.actionText}
            />
            <SecondaryButton
              text="Save"
              onPress={handleSubmit}
              disabled={!canSave}
              style={styles.actionButton}
              textStyle={styles.actionText}
            />
          </View>
        </Card>
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
      backgroundColor: theme.bg.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      backgroundColor:
        Platform.OS === 'ios' ? 'transparent' : theme.bg.softPrimary,
      borderRadius: 16,
      overflow: 'hidden',
      padding: 20,
      gap: 16,
    },
    title: {
      fontSize: fontSizes.md,
      fontFamily: fontFamily.medium,
      color: theme.text.primary,
      textAlign: 'center',
    },
    input: {
      borderWidth: 1,
      borderColor: theme.border.soft,
      backgroundColor: theme.bg.softPrimary,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: fontSizes.md,
      fontFamily: fontFamily.regular,
      color: theme.text.primary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.bg.dialogAction,
      borderColor: 'transparent',
    },
    actionText: {
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
    },
  });
