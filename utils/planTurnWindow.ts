import type { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import {
  LARGE_CONTEXT_WINDOW_TOKENS,
  estimatePromptTokens,
  getConversationWindowTokens,
  getSourceTokenBudget,
  type ConversationMemory,
} from '../constants/context-window';
import { WHOLE_DOCUMENT_BUDGET_SHARE } from '../constants/retrieval';
import {
  decideAutoWindow,
  largeWindowBlocker,
  type AutoWindowReason,
  type WindowEnvironment,
} from '../constants/auto-window';
import type { Model } from '../database/modelRepository';
import { type ContextChunk, formatContextChunks } from './contextUtils';
import { conversationWindowFor } from './conversationWindow';
import { deviceMemoryGBOrZero } from './deviceMemory';
import { loadDocumentChunks } from './hybridRetrieval';
import { isModelCompatibleWithRam } from './modelCompatibility';
import { modelContextCapacity } from './modelContextCapacity';

interface TurnWindowStats {
  tokens: number;
  reason: AutoWindowReason;
}

export interface TurnWindow {
  memory: ConversationMemory;
  stats: TurnWindowStats;
  ceilingTokens: number;
  passesWholeDocument: boolean;
}

export interface AttachedDocument {
  sourceId: number;
  name: string;
}

const RAW_CHUNK_TOKENS_PAST_BUDGET_FACTOR = 2;

const wholeDocumentBudgetAtLargeWindow = (
  model: Model,
  memory: ConversationMemory,
  thinkingEnabled: boolean
): number =>
  Math.floor(
    getSourceTokenBudget(model, {
      ...conversationWindowFor(model, {
        memory,
        thinkingEnabled,
        carriesSources: true,
      }),
      ceilingTokens: LARGE_CONTEXT_WINDOW_TOKENS,
    }) * WHOLE_DOCUMENT_BUDGET_SHARE
  );

export interface PlanTurnWindowParams {
  model: Model;
  memory: ConversationMemory;
  thinkingEnabled: boolean;
  attachedDocuments: AttachedDocument[];
  vectorStore: OPSQLiteVectorStore | null;
}

const attachedDocumentTokens = async (
  vectorStore: OPSQLiteVectorStore | null,
  documents: AttachedDocument[],
  budgetTokens: number
): Promise<number> => {
  if (!vectorStore || documents.length === 0) return 0;
  const clearlyTooLarge = budgetTokens * RAW_CHUNK_TOKENS_PAST_BUDGET_FACTOR;
  try {
    const chunks: ContextChunk[] = [];
    let rawTokens = 0;
    for (const { sourceId, name } of documents) {
      const documentChunks = await loadDocumentChunks(
        vectorStore,
        sourceId,
        name
      );
      if (documentChunks.length === 0) return 0;
      for (const chunk of documentChunks) {
        rawTokens += estimatePromptTokens(chunk.document ?? '');
        if (rawTokens > clearlyTooLarge) return rawTokens;
      }
      chunks.push(...documentChunks);
    }
    return estimatePromptTokens(formatContextChunks(chunks).join(' '));
  } catch {
    return 0;
  }
};

export const planTurnWindow = async ({
  model,
  memory,
  thinkingEnabled,
  attachedDocuments,
  vectorStore,
}: PlanTurnWindowParams): Promise<TurnWindow> => {
  const deviceRamGB = deviceMemoryGBOrZero();
  const environment: WindowEnvironment = {
    memory,
    thinking: thinkingEnabled && !!model.thinking,
    deviceRamGB,
    modelCapacityTokens: modelContextCapacity(model.id),
    modelFitsDevice: isModelCompatibleWithRam(model, deviceRamGB),
  };
  const documentAttached = attachedDocuments.length > 0;
  const wholeDocumentBudgetTokens = wholeDocumentBudgetAtLargeWindow(
    model,
    memory,
    thinkingEnabled
  );
  const documentCanRaiseWindow =
    documentAttached && largeWindowBlocker(environment) === null;
  const documentTokens = documentCanRaiseWindow
    ? await attachedDocumentTokens(
        vectorStore,
        attachedDocuments,
        wholeDocumentBudgetTokens
      )
    : 0;
  const decision = decideAutoWindow({
    ...environment,
    documentAttached,
    documentTokens,
    wholeDocumentBudgetTokens,
  });
  const tokens = getConversationWindowTokens(
    model,
    conversationWindowFor(model, {
      memory,
      thinkingEnabled,
      ceilingTokens: decision.ceilingTokens,
    })
  );
  return {
    memory,
    stats: { tokens, reason: decision.reason },
    ceilingTokens: decision.ceilingTokens,
    passesWholeDocument: decision.reason === 'whole-document',
  };
};
