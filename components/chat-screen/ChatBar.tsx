import React, { Ref, RefObject } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import { Model } from '../../database/modelRepository';
import { fontFamily } from '../../styles/fontFamily';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { ScrollView } from 'react-native-gesture-handler';

interface Props {
  chatId: number | null;
  userInput: string;
  setUserInput: (text: string) => void;
  onSend: () => void;
  onSelectModel: () => void;
  inputRef: Ref<TextInput>;
  model: Model | null;
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

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
  } = useLLMStore();

  return (
    <View
      style={{ ...styles.container, backgroundColor: theme.bg.softPrimary }}
    >
      {chatId && !model && (
        <TouchableOpacity
          style={{
            ...styles.modelSelection,
            marginBottom: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            paddingBottom: 12,
          }}
          onPress={() => {
            onSelectModel();
          }}
        >
          <Text style={styles.selectedModel}>{'Select Model'}</Text>
          <RotateLeft width={20} height={20} />
        </TouchableOpacity>
      )}
      {model && model.isDownloaded === 1 && (
        <View
          style={{ ...styles.content, backgroundColor: theme.bg.strongPrimary }}
        >
          <TextInput
            ref={inputRef}
            style={{ ...styles.input, color: theme.text.contrastPrimary }}
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
            placeholder={'Ask about anything...'}
            placeholderTextColor={theme.text.contrastTertiary}
            value={userInput}
            onChangeText={setUserInput}
          />
          <View style={styles.buttonBar}>
            {userInput && !isGenerating && !isProcessingPrompt && (
              <TouchableOpacity
                style={{
                  ...styles.sendButton,
                  backgroundColor: theme.bg.main,
                }}
                onPress={onSend}
              >
                <SendIcon
                  width={20}
                  height={20}
                  style={{ color: theme.text.contrastPrimary }}
                />
              </TouchableOpacity>
            )}
            {(isGenerating || isProcessingPrompt) && (
              <TouchableOpacity
                style={{
                  ...styles.sendButton,
                  backgroundColor: theme.bg.main,
                }}
                onPress={interrupt}
              >
                <PauseIcon
                  height={13.33}
                  width={13.33}
                  style={{ color: theme.text.contrastPrimary }}
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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  modelSelection: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 0,
    paddingBottom: 12,
    borderRadius: 8,
  },
  selectedModel: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    width: '80%',
  },
  content: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 18,
    padding: 16,
  },
  input: {
    fontSize: 16,
    lineHeight: 30,
    height: 48,
    color: '#fff',
    fontFamily: fontFamily.regular,
    width: '80%',
    textAlignVertical: 'center',
  },
  sendButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  buttonBar: {
    justifyContent: 'center',
    alignItems: 'flex-end',
    width: '20%',
  },
});
