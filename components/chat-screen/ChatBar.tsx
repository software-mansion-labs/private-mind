import React, { Ref, RefObject, useMemo } from 'react';
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
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import RotateLeft from '../../assets/icons/rotate_left.svg';
import { Theme } from '../../styles/colors';
import CircleButton from '../CircleButton';

interface Props {
  chatId: number | null;
  userInput: string;
  setUserInput: (text: string) => void;
  onSend: () => void;
  onSelectModel: () => void;
  onSelectSource: () => void;
  inputRef: Ref<TextInput>;
  model: Model | undefined;
  scrollRef: RefObject<ScrollView | null>;
  isAtBottom: boolean;
  activeSourcesCount: number;
}

const ChatBar = ({
  chatId,
  userInput,
  setUserInput,
  onSend,
  onSelectModel,
  onSelectSource,
  inputRef,
  model,
  scrollRef,
  isAtBottom,
  activeSourcesCount,
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
        <View
          style={{
            flexDirection: 'column',
            backgroundColor: theme.bg.strongPrimary,
            borderRadius: 18,
            padding: 16,
            gap: 16,
            justifyContent: 'center',
          }}
        >
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
            <View style={styles.buttonBar}></View>
          </View>
          <View
            style={{
              flexDirection: 'row',
              width: '100%',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={onSelectSource}
                style={{
                  padding: 8,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: theme.border.contrast,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {activeSourcesCount > 0 && (
                  <View
                    style={{
                      borderRadius: 9999,
                      width: 20,
                      height: 20,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: theme.bg.main,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: fontSizes.sm,
                        fontFamily: fontFamily.medium,
                        color: theme.text.contrastPrimary,
                      }}
                    >
                      {activeSourcesCount}
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    color: theme.text.contrastPrimary,
                    lineHeight: lineHeights.sm,
                  }}
                >
                  Sources
                </Text>
              </TouchableOpacity>
            </View>
            {userInput && !isGenerating && !isProcessingPrompt ? (
              <CircleButton
                icon={SendIcon}
                onPress={onSend}
                backgroundColor={theme.bg.main}
                color={theme.text.contrastPrimary}
              />
            ) : null}

            {(isGenerating || isProcessingPrompt) && (
              <CircleButton
                icon={PauseIcon}
                size={13.33}
                onPress={interrupt}
                backgroundColor={theme.bg.main}
                color={theme.text.contrastPrimary}
              />
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
      backgroundColor: theme.bg.softPrimary,
      paddingHorizontal: 16,
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
      width: '100%',
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
  });
