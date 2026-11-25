import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import type {
  Message,
  RetrievalStats,
  SourceDocument,
} from '../../../database/chatRepository';
import type { Attachment } from '../../../hooks/useAttachment';
import { useLLMStore, type LLMStore } from '../../../store/llmStore';
import { useSourceStore } from '../../../store/sourceStore';
import { useWebSearchStore } from '../../../store/webSearchStore';
import { chosenConversationMemory } from '../../../utils/conversationWindow';
import type { LFMEmbeddings } from '../../../utils/lfmEmbeddings';
import type { AttachedDocument } from '../../../utils/planTurnWindow';
import { gatherDocumentSources } from './gatherDocumentSources';
import { gatherWebSources } from './gatherWebSources';
import { planSourceRoom } from './planSourceRoom';

export type BuildSources = Parameters<LLMStore['sendChatMessage']>[2];

export interface SourceBuilderParams {
  targetChatId: number;
  userInput: string;
  imagePath?: string;
  attachments?: Attachment[];
  history: Message[];
  enabledSources: number[];
  systemPrompt: string;
  thinkingEnabled: boolean;
  vectorStore: OPSQLiteVectorStore | null;
  embeddings: LFMEmbeddings | null;
  runWithModelOffloaded: LLMStore['runWithModelOffloaded'];
  enableSource: (chatId: number, sourceId: number) => Promise<void>;
}

const attachedDocumentsOf = (attachments?: Attachment[]): AttachedDocument[] =>
  (attachments ?? []).flatMap((attachment) =>
    attachment.type === 'document' && attachment.sourceId
      ? [{ sourceId: attachment.sourceId, name: attachment.name ?? '' }]
      : []
  );

const existingAttachmentSourceIds = (
  targetChatId: number,
  attachments: Attachment[] | undefined,
  existingSourceIds: Set<number>
): number[] =>
  attachedDocumentsOf(attachments)
    .map((document) => document.sourceId)
    .filter((sourceId) => {
      const exists = existingSourceIds.has(sourceId);
      if (!exists) {
        console.warn('Skipping missing attachment source before send', {
          chatId: targetChatId,
          sourceId,
        });
      }
      return exists;
    });

export const createSourceBuilder = ({
  targetChatId,
  userInput,
  imagePath,
  attachments,
  history,
  enabledSources,
  systemPrompt,
  thinkingEnabled,
  vectorStore,
  embeddings,
  runWithModelOffloaded,
  enableSource,
}: SourceBuilderParams): BuildSources => {
  const memory = chosenConversationMemory();
  const attachedDocuments = attachedDocumentsOf(attachments);

  const readDigest = (): string | undefined => {
    const llmState = useLLMStore.getState();
    return llmState.activeChatDigestChatId === targetChatId
      ? (llmState.activeChatDigest ?? undefined)
      : undefined;
  };

  // Deferred so retrieval runs only after the optimistic message is on screen.
  return async (signal, readyModel) => {
    const model = readyModel ?? useLLMStore.getState().model;
    const room = await planSourceRoom({
      model,
      memory,
      thinkingEnabled,
      attachedDocuments,
      vectorStore,
    });
    const webSearchEnabled = useWebSearchStore
      .getState()
      .isEnabled(targetChatId);
    const sources = useSourceStore.getState().sources;
    const attachmentSourceIds = existingAttachmentSourceIds(
      targetChatId,
      attachments,
      new Set(sources.map((source) => source.id))
    );

    let context: string[] = [];
    let sourceDocuments: SourceDocument[] = [];
    let preferredSourceDocuments: SourceDocument[] = [];
    let recallSimilarities: Map<number, number> | null = null;
    const retrievalStats: RetrievalStats = room.turnWindow
      ? { window: room.turnWindow.stats }
      : {};
    const hasRagSources =
      enabledSources.length > 0 || attachmentSourceIds.length > 0;
    if (vectorStore && hasRagSources) {
      const documents = await gatherDocumentSources({
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
      });
      ({ context, sourceDocuments, preferredSourceDocuments } = documents);
      recallSimilarities = documents.recallSimilarities;
      retrievalStats.rag = documents.stats;
    }

    const answersFromDocument = sourceDocuments.length > 0;
    const web = await gatherWebSources({
      webSearchEnabled,
      userInput,
      imagePath,
      documentAttachedHere: attachmentSourceIds.length > 0,
      answersFromDocument,
      history,
      readDigest,
      embeddings,
      modelProfile: room.modelProfile,
      context,
      systemPrompt,
      signal,
      runWithModelOffloaded,
    });
    if (web) {
      context = [...context, ...web.context];
      sourceDocuments = [...sourceDocuments, ...web.sourceDocuments];
      if (web.stats) retrievalStats.web = web.stats;
    }

    for (const sourceId of attachmentSourceIds) {
      if (!enabledSources.includes(sourceId)) {
        await enableSource(targetChatId, sourceId);
      }
    }

    return {
      context,
      sourceDocuments,
      preferredSourceDocuments,
      webIntent: web?.webIntent,
      webIntentKind: web?.webIntentKind,
      webSubQueries: web?.webSubQueries,
      webWeak: web?.webWeak,
      webSearchFailed: web?.webSearchFailed,
      retrievalStats,
      recallSimilarities,
      answersFromDocument,
      ceilingTokens: room.turnWindow?.ceilingTokens,
      conversationMemory: memory,
    };
  };
};
