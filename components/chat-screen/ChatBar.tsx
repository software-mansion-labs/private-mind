import React, {
  Ref,
  RefObject,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import { Model } from '../../database/modelRepository';
import { fontFamily, fontSizes, lineHeights } from '../../styles/fontStyles';
import { useTheme } from '../../context/ThemeContext';
import { useLLMStore } from '../../store/llmStore';
import { ScrollView } from 'react-native-gesture-handler';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import { Theme } from '../../styles/colors';
import ChatBarActions from './ChatBarActions';
import ChatSpeechInput from './ChatSpeechInput';
import PromptSuggestions from './PromptSuggestions';
import { AudioManager } from 'react-native-audio-api';
import Toast from 'react-native-toast-message';

interface Props {
  chatId: number | null;
  onSend: (userInput: string) => void;
  onSelectModel: () => void;
  onSelectSource: () => void;
  onSelectPrompt: (prompt: string) => void;
  ref: Ref<{
    clear: () => void;
    setInput: (text: string) => void;
  }>;
  model: Model | undefined;
  scrollRef: RefObject<ScrollView | null>;
  isAtBottom: boolean;
  activeSourcesCount: number;
  hasMessages: boolean;
}

const ChatBar = ({
  chatId,
  onSend,
  onSelectModel,
  onSelectSource,
  onSelectPrompt,
  ref,
  model,
  scrollRef,
  isAtBottom,
  activeSourcesCount,
  hasMessages,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [userInput, setUserInput] = useState('');

  useImperativeHandle(
    ref,
    () => ({
      clear: () => setUserInput(''),
      setInput: (text: string) => setUserInput(text),
    }),
    []
  );

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
  } = useLLMStore();

  const loadSelectedModel = async () => {
    if (model?.isDownloaded && loadedModel?.id !== model.id) {
      return loadModel(model);
    }
  };

  const [showSpeechInput, setShowSpeechInput] = React.useState(false);

  const openSpeechInput = async () => {
    const permissionStatus = await AudioManager.requestRecordingPermissions();
    if (permissionStatus !== 'Granted') {
      Toast.show({
        type: 'defaultToast',
        text1: 'Microphone permission is required to record messages.',
      });
      return;
    }

    loadSelectedModel();
    setShowSpeechInput(true);
  };

  if (showSpeechInput) {
    const handleSubmit = (transcript: string) => {
      setShowSpeechInput(false);
      if (transcript) {
        onSend(transcript);
      }
    };

    return (
      <View style={styles.container}>
        <ChatSpeechInput
          onSubmit={handleSubmit}
          onCancel={() => setShowSpeechInput(false)}
        />
      </View>
    );
  }

  if (chatId && !model) {
    return (
      <View style={styles.container}>
        <TouchableOpacity style={styles.modelSelection} onPress={onSelectModel}>
          <Text style={styles.selectedModel}>Select Model</Text>
          <RotateLeft
            width={20}
            height={20}
            style={{ color: theme.text.primary }}
          />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {model?.isDownloaded && (
        <>
          {!hasMessages && (
            <View style={styles.suggestionsContainer}>
              <PromptSuggestions onSelectPrompt={onSelectPrompt} />
            </View>
          )}
          <View style={styles.inputContainer}>
            <View style={styles.content}>
              <TextInput
                style={styles.input}
                multiline
                onFocus={async () => {
                  if (!isAtBottom) return;
                  await loadSelectedModel();
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
            </View>
            <ChatBarActions
              onSelectSource={onSelectSource}
              activeSourcesCount={activeSourcesCount}
              userInput={userInput}
              onSend={() => onSend(userInput)}
              isGenerating={isGenerating}
              isProcessingPrompt={isProcessingPrompt}
              onInterrupt={interrupt}
              onSpeechInput={openSpeechInput}
            />
          </View>
        </>
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
      paddingHorizontal: 16,
    },
    suggestionsContainer: {
      marginBottom: 12,
    },
    modelSelection: {
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
      color: theme.text.primary,
    },
    content: {
      flexDirection: 'row',
      width: '100%',
    },
    inputContainer: {
      flexDirection: 'column',
      backgroundColor: theme.bg.strongPrimary,
      borderRadius: 18,
      padding: 16,
      gap: 16,
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      fontSize: fontSizes.md,
      lineHeight: lineHeights.md,
      fontFamily: fontFamily.regular,
      textAlignVertical: 'center',
      color: theme.text.contrastPrimary,
    },
    buttonBar: {
      justifyContent: 'center',
      alignItems: 'flex-end',
    },
    barButton: {
      width: 36,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    iconContrast: {
      color: theme.text.contrastPrimary,
    },
  });
