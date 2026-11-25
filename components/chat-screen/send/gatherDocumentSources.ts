import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type { Message } from '../../../database/chatRepository';
import type { Model } from '../../../database/modelRepository';
import type { ConversationMemory } from '../../../constants/context-window';
import type { LLMStore } from '../../../store/llmStore';
import { embedConversationForRecall } from '../../../utils/conversationRecall';
import type { LFMEmbeddings } from '../../../utils/lfmEmbeddings';
import {
  buildMessageSources,
  type BuildMessageSourcesParams,
  type MessageSources,
} from '../../../utils/messageSources';
import { recallPoolFor, type SourceRoom } from './planSourceRoom';

export interface DocumentSourcesParams {
  userInput: string;
  attachmentSourceIds: number[];
  enabledSources: number[];
  sources: BuildMessageSourcesParams['sources'];
  vectorStore: OPSQLiteVectorStore;
  embeddings: LFMEmbeddings | null;
  room: SourceRoom;
  model: Model | null;
  memory: ConversationMemory;
  thinkingEnabled: boolean;
  history: Message[];
  readDigest: () => string | undefined;
  runWithModelOffloaded: LLMStore['runWithModelOffloaded'];
}

export interface DocumentSources extends MessageSources {
  recallSimilarities: Map<number, number> | null;
  stats: { ms: number; chunks: number };
}

export const gatherDocumentSources = async ({
  userInput,
  attachmentSourceIds,
  enabledSources,
  sources,
  vectorStore,
  embeddings,
  room,
  model,
  memory,
  thinkingEnabled,
  history,
  readDigest,
  runWithModelOffloaded,
}: DocumentSourcesParams): Promise<DocumentSources> => {
  const { modelProfile, turnWindow, sourceTokenBudget } = room;
  let recallSimilarities: Map<number, number> | null = null;
  const prepareSources = async () => {
    const gathered = await buildMessageSources({
      userInput,
      attachmentSourceIds,
      enabledSources,
      sources,
      vectorStore,
      embeddings,
      maxRelevantChunks: modelProfile.ragMaxRelevantChunks,
      extraChunks: {
        count: modelProfile.ragExtraChunks,
        maxSimilarityGap: modelProfile.ragExtraChunkMaxSimilarityGap,
      },
      sourceTokenBudget,
      passWholeDocument: !!turnWindow?.passesWholeDocument,
      history,
      digest: readDigest(),
    });
    const recallPool =
      gathered.sourceDocuments.length === 0
        ? recallPoolFor({ model, memory, thinkingEnabled, turnWindow, history })
        : [];
    if (recallPool.length > 0) {
      recallSimilarities = await embedConversationForRecall({
        messages: recallPool,
        question: userInput,
        embedder: embeddings,
      });
    }
    return gathered;
  };
  const startedAt = Date.now();
  const gathered = embeddings
    ? await runWithModelOffloaded(
        () => embeddings.runWithLoadedModel(prepareSources),
        { restore: false }
      )
    : await prepareSources();
  return {
    ...gathered,
    recallSimilarities,
    stats: { ms: Date.now() - startedAt, chunks: gathered.context.length },
  };
};
