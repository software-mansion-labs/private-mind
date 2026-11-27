import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { Message } from '../../../database/chatRepository';
import type { Model } from '../../../database/modelRepository';
import {
  getConversationCharBudget,
  getSourceTokenBudget,
  sourceRoomFor,
  type ConversationMemory,
} from '../../../constants/context-window';
import {
  getModelProfile,
  withExtendedSourceRoom,
  type ModelProfile,
} from '../../../constants/model-profiles';
import {
  recallEmbeddingPool,
  type EmbeddableMessage,
} from '../../../utils/recall/recallEmbeddings';
import { conversationWindowFor } from '../../../utils/conversationWindow';
import {
  planTurnWindow,
  type AttachedDocument,
  type TurnWindow,
} from '../../../utils/planTurnWindow';

export interface SourceRoomParams {
  model: Model | null;
  memory: ConversationMemory;
  thinkingEnabled: boolean;
  attachedDocuments: AttachedDocument[];
  vectorStore: OPSQLiteVectorStore | null;
}

export interface SourceRoom {
  turnWindow: TurnWindow | undefined;
  modelProfile: ModelProfile;
  sourceTokenBudget: number | undefined;
}

export const planSourceRoom = async ({
  model,
  memory,
  thinkingEnabled,
  attachedDocuments,
  vectorStore,
}: SourceRoomParams): Promise<SourceRoom> => {
  if (!model) {
    return {
      turnWindow: undefined,
      modelProfile: withExtendedSourceRoom(getModelProfile(model), 'standard'),
      sourceTokenBudget: undefined,
    };
  }
  const turnWindow = await planTurnWindow({
    model,
    memory,
    thinkingEnabled,
    attachedDocuments,
    vectorStore,
  });
  const sourceWindow = conversationWindowFor(model, {
    memory,
    thinkingEnabled,
    carriesSources: true,
    ceilingTokens: turnWindow.ceilingTokens,
  });
  return {
    turnWindow,
    modelProfile: withExtendedSourceRoom(
      getModelProfile(model),
      sourceRoomFor(model, sourceWindow)
    ),
    sourceTokenBudget: getSourceTokenBudget(model, sourceWindow),
  };
};

export interface RecallPoolParams {
  model: Model | null;
  memory: ConversationMemory;
  thinkingEnabled: boolean;
  turnWindow: TurnWindow | undefined;
  history: Message[];
}

export const recallPoolFor = ({
  model,
  memory,
  thinkingEnabled,
  turnWindow,
  history,
}: RecallPoolParams): EmbeddableMessage[] => {
  if (!model) return [];
  const conversationBudgetChars = getConversationCharBudget(
    model,
    conversationWindowFor(model, {
      memory,
      thinkingEnabled,
      ceilingTokens: turnWindow?.ceilingTokens,
    }),
    history.map((message) => message.content).join(' ')
  );
  return recallEmbeddingPool(history, conversationBudgetChars);
};
