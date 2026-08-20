import { useCallback } from 'react';
import type { SQLiteDatabase } from 'expo-sqlite';
import Toast from 'react-native-toast-message';
import {
  checkIfChatExists,
  setChatSettings,
  type Chat,
  type ChatSettings,
} from '../../database/chatRepository';
import { Model } from '../../database/modelRepository';
import { useChatStore } from '../../store/chatStore';
import { useLLMStore } from '../../store/llmStore';
import { useModelStore } from '../../store/modelStore';
import { isWebSearchReady } from '../../constants/model-profiles';
import { hasMemoryForWebSearch } from '../../utils/modelCompatibility';

interface UseChatScreenActionsOptions {
  chatId: number;
  chat: Chat | undefined;
  model: Model | undefined;
  chatSettings: {
    systemPrompt: string;
    thinkingEnabled: boolean;
    webSearchEnabled: boolean;
  };
  setSetting: (
    key: 'title' | 'systemPrompt' | 'thinkingEnabled' | 'webSearchEnabled',
    value: string | boolean
  ) => void;
  db: SQLiteDatabase;
  inputRef: React.RefObject<{ setInput: (text: string) => void } | null>;
}

export const useChatScreenActions = ({
  chatId,
  chat,
  model,
  chatSettings,
  setSetting,
  db,
  inputRef,
}: UseChatScreenActionsOptions) => {
  const { model: loadedModel, loadModel } = useLLMStore();
  const { getModelById } = useModelStore();
  const { phantomChat, setPhantomChatSettings } = useChatStore();

  const handleThinkingToggle = async () => {
    if (!model?.thinking) {
      Toast.show({
        type: 'defaultToast',
        text1: 'Thinking cannot be enabled for this model.',
      });
      return;
    }

    const previous = chatSettings?.thinkingEnabled;
    const next = !previous;
    const newSettings: ChatSettings = {
      systemPrompt: chatSettings?.systemPrompt || '',
      thinkingEnabled: next,
    };

    setSetting('thinkingEnabled', next);

    try {
      if (phantomChat?.id === chatId) {
        const chatExists = await checkIfChatExists(db, chatId);
        if (chatExists) {
          await setChatSettings(db, chatId, newSettings);
          return;
        }

        await setPhantomChatSettings(newSettings);
      } else {
        await setChatSettings(db, chatId, newSettings);
      }
    } catch (error) {
      setSetting('thinkingEnabled', previous ?? false);
      console.error('Failed to update thinking setting:', error);
    }
  };

  const handleWebSearchToggle = () => {
    if (!chatSettings.webSearchEnabled && !isWebSearchReady(model)) {
      Toast.show({
        type: 'defaultToast',
        text1:
          'This model cannot use web results reliably — pick a larger one.',
      });
      return;
    }
    if (!chatSettings.webSearchEnabled && !hasMemoryForWebSearch(model)) {
      Toast.show({
        type: 'defaultToast',
        text1: `${model?.modelName ?? 'This model'} already fills this phone's memory — searching alongside it would close the app. Pick a smaller model.`,
      });
      return;
    }
    setSetting('webSearchEnabled', !chatSettings.webSearchEnabled);
  };

  const handleSelectPrompt = useCallback(
    async (prompt: string) => {
      inputRef.current?.setInput(prompt);

      const currentModel =
        model || (chat?.modelId ? getModelById(chat.modelId) : undefined);
      if (currentModel?.isDownloaded && loadedModel?.id !== currentModel.id) {
        try {
          await loadModel(currentModel);
        } catch (error) {
          console.error('Error loading model on prompt selection:', error);
        }
      }
    },
    [model, loadedModel, loadModel, getModelById, chat?.modelId, inputRef]
  );

  return { handleThinkingToggle, handleWebSearchToggle, handleSelectPrompt };
};
