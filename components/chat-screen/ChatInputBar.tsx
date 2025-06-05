import React, { Ref } from 'react';
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

interface Props {
  chatId: number | null;
  userInput: string;
  setUserInput: (text: string) => void;
  onSend: () => void;
  onSelectModel: () => void;
  inputRef: Ref<TextInput>;
  model: Model | null;
}

const ChatInputBar = ({
  chatId,
  userInput,
  setUserInput,
  onSend,
  onSelectModel,
  inputRef,
  model,
}: Props) => {
  const { theme } = useTheme();

  const {
    isLoading,
    isGenerating,
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
      {chatId && model && loadedModel?.id !== model?.id && (
        <TouchableOpacity
          style={{
            ...styles.modelSelection,
            marginBottom: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
            paddingBottom: 12,
          }}
          onPress={() => {
            loadModel(model);
          }}
        >
          <Text style={styles.selectedModel}>
            {'Load Model'} {model.id}
          </Text>
          <RotateLeft width={20} height={20} />
        </TouchableOpacity>
      )}
      {model && loadedModel?.id === model.id && (
        <View
          style={{ ...styles.content, backgroundColor: theme.bg.strongPrimary }}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            multiline
            placeholder={!isLoading ? 'Ask about anything...' : 'Loading...'}
            placeholderTextColor={theme.text.contrastTertiary}
            value={userInput}
            onChangeText={setUserInput}
          />
          <View style={styles.buttonBar}>
            {userInput && (
              <TouchableOpacity style={styles.sendButton} onPress={onSend}>
                <SendIcon width={20} height={20} />
              </TouchableOpacity>
            )}
            {isGenerating && (
              <TouchableOpacity style={styles.sendButton} onPress={interrupt}>
                <PauseIcon height={20} width={20} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

export default ChatInputBar;

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
    borderRadius: 8,
    padding: 16,
  },
  selectButtonText: {
    fontSize: 12,
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
