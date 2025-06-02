import React, { Ref } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import SendIcon from '../../assets/icons/send_icon.svg';
import PauseIcon from '../../assets/icons/pause_icon.svg';
import { Model } from '../../database/modelRepository';
import ColorPalette from '../../colors';
import { fontFamily } from '../../fontFamily';
import RotateLeft from '../../assets/icons/rotate_left.svg';

interface Props {
  isLoading: boolean;
  isGenerating: boolean;
  selectedModel: Model | null;
  userInput: string;
  setUserInput: (text: string) => void;
  onSend: () => void;
  onSelectModel: () => void;
  interrupt: () => void;
  inputRef: Ref<TextInput>;
}

const ChatInputBar = ({
  isLoading,
  isGenerating,
  selectedModel,
  userInput,
  setUserInput,
  onSend,
  onSelectModel,
  interrupt,
  inputRef,
}: Props) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={
          selectedModel
            ? styles.modelSelection
            : {
                ...styles.modelSelection,
                marginBottom: 0,
                borderBottomLeftRadius: 8,
                borderBottomRightRadius: 8,
                paddingBottom: 12,
              }
        }
        onPress={onSelectModel}
      >
        <Text style={styles.selectedModel}>
          {selectedModel ? selectedModel.id : 'Select a model'}
        </Text>
        <RotateLeft width={20} height={20} />
      </TouchableOpacity>
      {selectedModel && (
        <View style={styles.content}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            multiline
            placeholder="Ask about anything..."
            placeholderTextColor={ColorPalette.blueDark}
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
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderWidth: 1,
    marginBottom: -8,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
  },
  selectedModel: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    width: '80%',
  },
  content: {
    backgroundColor: ColorPalette.primary,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 8,
    padding: 16,
  },
  selectButtonText: {
    color: ColorPalette.primary,
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
