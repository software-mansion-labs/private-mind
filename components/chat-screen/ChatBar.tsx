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
import CircleButton from '../CircleButton';

interface Props {
  chatId: number | null;
  onSend: (userInput: string) => void;
  onSelectModel: () => void;
  ref: Ref<{ clear: () => void }>;
  model: Model | undefined;
  scrollRef: RefObject<ScrollView | null>;
  isAtBottom: boolean;
}

const ChatBar = ({
  chatId,
  onSend,
  onSelectModel,
  ref,
  model,
  scrollRef,
  isAtBottom,
}: Props) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const textInputRef = React.useRef<TextInput>(null);
  const [userInput, setUserInput] = useState('');

  useImperativeHandle(ref, () => ({ clear: () => setUserInput('') }), []);

  const {
    isGenerating,
    isProcessingPrompt,
    interrupt,
    loadModel,
    model: loadedModel,
  } = useLLMStore();

  const renderButtons = () => {
    if (isGenerating || isProcessingPrompt) {
      return (
        <CircleButton
          icon={PauseIcon}
          size={13.33}
          onPress={interrupt}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      );
    }

    if (userInput) {
      return (
        <CircleButton
          icon={SendIcon}
          onPress={() => onSend(userInput)}
          backgroundColor={theme.bg.main}
          color={theme.text.contrastPrimary}
        />
      );
    }

    return null
  };

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
          <View style={styles.buttonBar}>{renderButtons()}</View>
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
      paddingHorizontal: 16,
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
      width: '80%',
      color: theme.text.primary,
    },
    content: {
      flexDirection: 'row',
      alignItems: 'center',
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
  });
