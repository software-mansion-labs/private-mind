import React, { Ref, RefObject, useMemo } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Model } from '../../database/modelRepository';
import { fontFamily, fontSizes } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { ScrollView } from 'react-native-gesture-handler';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import { Theme } from '../../styles/colors';

interface Props {
  chatId: number | null;
  userInput: string;
  setUserInput: (text: string) => void;
  onSend: () => void;
  onSelectModel: () => void;
  inputRef: Ref<TextInput>;
  model: Model | undefined;
  scrollRef: RefObject<ScrollView | null>;
  isAtBottom: boolean;
}

const ChatBar = ({
  chatId,
  userInput,
  setUserInput,
  onSend,
  onSelectModel,
  inputRef,
  model,
  scrollRef,
  isAtBottom,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
  } = useLLMStore();

  return (
    <View style={styles.container}>
      {chatId && !model && (
        <TouchableOpacity style={styles.modelSelection} onPress={onSelectModel}>
          <Text style={styles.selectedModel}>Select Model</Text>
          <RotateLeft
            width={20}
            height={20}
            style={{ color: theme.text.primary }}
          />
        </TouchableOpacity>
      )}

      {model?.isDownloaded && (
        <View style={styles.content}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            multiline
            onFocus={async () => {
              if (!isAtBottom) return;
              if (loadedModel?.id !== model.id) {
                await loadModel(model);
              }
              setTimeout(() => {
                scrollRef.current?.scrollToEnd({ animated: true });
              }, 25);
            }}
            placeholder="Ask about anything..."
            placeholderTextColor={theme.text.contrastTertiary}
            value={userInput}
            onChangeText={setUserInput}
            numberOfLines={3}
          />
          <View style={styles.buttonBar}>
            {userInput && !isGenerating && !isProcessingPrompt ? (
              <TouchableOpacity style={styles.sendButton} onPress={onSend}>
                <SendIcon width={20} height={20} style={styles.iconContrast} />
              </TouchableOpacity>
            ) : null}

            {(isGenerating || isProcessingPrompt) && (
              <TouchableOpacity style={styles.sendButton} onPress={interrupt}>
                <PauseIcon
                  height={13.33}
                  width={13.33}
                  style={styles.iconContrast}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default ChatBar;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      backgroundColor: theme.bg.softPrimary,
    },
    modelSelection: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      height: 52,
      borderWidth: 1,
      borderColor: theme.border.soft,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    selectedModel: {
      fontSize: 14,
      fontFamily: fontFamily.regular,
      width: '80%',
      color: theme.text.primary,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      height: 68,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: Platform.select({ ios: 8, default: 0 }),
      gap: 16,
      backgroundColor: theme.bg.strongPrimary,
    },
    input: {
      flex: 1,
      fontSize: fontSizes.md,
      lineHeight: 24,
      paddingVertical: 8,
      fontFamily: fontFamily.regular,
      textAlignVertical: 'center',
      color: theme.text.contrastPrimary,
    },
    buttonBar: {
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    sendButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 18,
      backgroundColor: theme.bg.main,
    },
    iconContrast: {
      color: theme.text.contrastPrimary,
    },
  });
