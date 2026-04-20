import { router } from 'expo-router';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Model } from '../database/modelRepository';
import { useChatStore } from '../store/chatStore';
import { useLLMStore } from '../store/llmStore';
import { useModelStore } from '../store/modelStore';
import { getNextChatId } from '../database/chatRepository';
import { getLastUsedModelId, setLastUsedModelId } from './lastUsedModel';

type NavMode = 'push' | 'replace';

export const startPhantomChat = async (
  db: SQLiteDatabase,
  mode: NavMode = 'push',
  explicitModel?: Model
) => {
  const { downloadedModels } = useModelStore.getState();
  if (!explicitModel && downloadedModels.length === 0) {
    router.replace('/');
    return;
  }

  const [lastId, nextChatId] = await Promise.all([
    explicitModel ? Promise.resolve(null) : getLastUsedModelId(),
    getNextChatId(db),
  ]);
  const model =
    explicitModel ??
    downloadedModels.find((m) => m.id === lastId) ??
    downloadedModels[0];

  await useChatStore.getState().initPhantomChat(nextChatId, model);
  // Must complete before navigating: otherwise the new phantom chat mounts
  // with stale messages from the previous chat, flashing the wrong layout.
  await useLLMStore.getState().setActiveChatId(null);
  // Fire and forget: not on the critical path for navigating.
  void setLastUsedModelId(model.id);

  const target = {
    pathname: `/chat/${nextChatId}`,
    params: { modelId: String(model.id) },
  } as const;

  if (mode === 'replace') {
    router.replace(target);
  } else {
    router.push(target);
  }
};
