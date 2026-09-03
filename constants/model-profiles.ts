import { type Model } from '../database/modelRepository';
import { getModelFamily } from '../utils/modelFamily';
import { MAX_RELEVANT_CHUNKS } from './retrieval';
import { WEB_FETCH_TOP_N_CONTENT, WEB_RETRIEVAL_TOP_K } from './web';

export type WebPlannerMode = 'llm' | 'verbatim';

export interface ModelProfile {
  webPlanner: WebPlannerMode;
  contextWindowTokens: number;
  generationReserveTokens: number;
  repetitionPenalty: number;
  webRetrievalTopK: number;
  webFetchTopNContent: number;
  ragMaxRelevantChunks: number;
  webEmbeddingRetrieval: boolean;
  webSearchReady: boolean;
  webSearchMinDeviceMemoryGB?: number;
}

export const GENERATION_RESERVE_SHARE = 0.25;
export const GENERATION_RESERVE_MIN_TOKENS = 256;

export const scaledGenerationReserve = (contextWindowTokens: number): number =>
  Math.max(
    GENERATION_RESERVE_MIN_TOKENS,
    Math.round(contextWindowTokens * GENERATION_RESERVE_SHARE)
  );

export const DEFAULT_PROFILE: ModelProfile = {
  webPlanner: 'verbatim',
  contextWindowTokens: 2048,
  generationReserveTokens: 512,
  repetitionPenalty: 1,
  webRetrievalTopK: WEB_RETRIEVAL_TOP_K,
  webFetchTopNContent: WEB_FETCH_TOP_N_CONTENT,
  ragMaxRelevantChunks: MAX_RELEVANT_CHUNKS,
  webEmbeddingRetrieval: true,
  webSearchReady: true,
};

export const WEB_PLANNER_MATRIX: Record<string, WebPlannerMode> = {
  'Qwen 3 - 0.6B': 'verbatim',
  'Qwen 3 - 1.7B': 'verbatim',
  'Qwen 2.5 - 0.5B': 'verbatim',
  'Qwen 2.5 - 1.5B': 'llm',
  'Qwen 2.5 - 3B': 'llm',
  'LLaMA 3.2 - 1B - QLoRa': 'llm',
  'LLaMA 3.2 - 1B - SpinQuant': 'llm',
  'LLaMA 3.2 - 3B - QLoRa': 'llm',
  'LLaMA 3.2 - 3B - SpinQuant': 'llm',
  'LFM 2.5 - 1.2B': 'llm',
  'LFM 2.5 VL - 1.6B': 'llm',
  'LFM 2.5 VL - 450M': 'verbatim',
  'Bielik - v3.0': 'llm',
  'Gemma 4 - 2B': 'llm',
  'Gemma 4 VL - 2B': 'llm',
};

export const PLANNER_EVIDENCE: Record<string, string> = {
  'LFM 2.5 VL - 450M':
    'Echoed the prompt\'s own few-shot demo ({"needs_search": false, ' +
    '"intent": "casual greeting"}) on 37 of 72 items, which silently disabled ' +
    'the search: half of all searchable items reached the answer step with 0 ' +
    'chars of context. Verbatim on the rest: 100% retrieval, 77% correct.',
  'Qwen 3 - 0.6B':
    '2/72 plans parsed. Verbatim on the rest: 100% retrieval, 71% correct.',
  'Qwen 2.5 - 0.5B':
    '1/72 plans parsed. Verbatim on the rest: 100% retrieval, 33% correct.',
  'Qwen 3 - 1.7B':
    '11/72 plans parsed; on the 2 items where a plan was actually used it ' +
    'mutated the entity ("Boeing 747-8" → "Boeing 749", "2023" → "2045") and ' +
    'both answers were wrong. Verbatim on the other 70: 100% retrieval, 85% correct.',
};

export const GENERATION_RESERVE_EVIDENCE: Record<string, string> = {
  'Qwen 3 - 1.7B':
    'Answer length over 259 stored answers from this model alone: p50 34 ' +
    'tokens, p75 74, p90 122, p95 156, p99 698, max 1527. A 512-token reserve ' +
    'would cut 4 of them (1.6%), the same count as 640 for twice the saving, ' +
    'and 3 of those 4 are degenerate loops truncateAtRepeatedClause cuts ' +
    'anyway. Every other model uses GENERATION_RESERVE_SHARE scaled from this ' +
    'one measurement and is UNCONFIRMED — a more verbose model may need more.',
};

export const WEB_ANSWER_EVIDENCE: Record<string, string> = {
  'Qwen 2.5 - 0.5B':
    '33% correct on the 72-item multilingual corpus with retrieval at 100% — ' +
    'the context it was handed contained the answer twice as often as its ' +
    'reply did. Web search disabled for it.',
  'Qwen 3 - 1.7B':
    'Single-hop factual: correct and in-language across PL/EN entity, weather ' +
    'and currency runs. Two-fact questions drop the second fact (asked for a ' +
    'price in złoty and euro, converted nothing); comparison questions can ' +
    'invert their own data (recommended the rainier city for cycling, 0.5mm ' +
    '51% vs 0.0mm 0%). On a fact its pretraining knows an old value for, it ' +
    'overrides the context outright: with the succession report promoted to ' +
    'Source 1, a recency rule in the system prompt AND beside the question, ' +
    'and "Andy Burnham is the current prime minister" verbatim in the ' +
    'context, it still named the predecessor — in English it contradicted ' +
    'itself in one sentence ("is Sir Keir Starmer. He served as Prime ' +
    'Minister from 2024 to 2026."). Ready for single-hop lookups whose ' +
    'answer it has no stale prior for.',
  'Gemma 4 - 2B':
    'Grounds correctly when fed (chancellor + date correct on both devices) ' +
    'but drifts language under thread pressure (answered a Polish question ' +
    'in Russian, an English one in Polish), wraps numbers in LaTeX, and its ' +
    '2.5 GB residency was lmkd-killed four times in one session on an 8 GB ' +
    'device (debug build). Planner parses 0% in budget, so gating relies on ' +
    'the client-side small-talk gate. Follows source order: with the ' +
    'succession report promoted to Source 1 and the recency rule in place ' +
    'it adjudicated the prime-minister conflict correctly (where it had ' +
    'confidently answered with the predecessor before), though as a clunky ' +
    'source-by-source enumeration. Not ready as a default web model.',
};

export const PROFILE_BY_FAMILY: Record<string, Partial<ModelProfile>> = {};

export const PROFILE_BY_MODEL: Record<string, Partial<ModelProfile>> = {
  'Qwen 2.5 - 0.5B': { webSearchReady: false },
  'Gemma 4 - 2B': { webSearchMinDeviceMemoryGB: 8 },
  'Gemma 4 VL - 2B': { webSearchMinDeviceMemoryGB: 8 },
  'Qwen 2.5 - 3B': { webSearchMinDeviceMemoryGB: 8 },
  'LLaMA 3.2 - 3B - QLoRa': { webSearchMinDeviceMemoryGB: 8 },
  'LLaMA 3.2 - 3B - SpinQuant': { webSearchMinDeviceMemoryGB: 8 },
};

export type ProfileTarget = Pick<Model, 'modelName' | 'family'>;

export const getModelProfile = (
  model: ProfileTarget | null | undefined
): ModelProfile => {
  if (!model) return DEFAULT_PROFILE;
  const family = getModelFamily(model);
  const planner = WEB_PLANNER_MATRIX[model.modelName];
  const merged = {
    ...DEFAULT_PROFILE,
    ...(planner ? { webPlanner: planner } : {}),
    ...(PROFILE_BY_FAMILY[family] ?? {}),
    ...(PROFILE_BY_MODEL[model.modelName] ?? {}),
  };
  const reserveIsExplicit =
    PROFILE_BY_MODEL[model.modelName]?.generationReserveTokens !== undefined ||
    PROFILE_BY_FAMILY[family]?.generationReserveTokens !== undefined;
  return reserveIsExplicit
    ? merged
    : {
        ...merged,
        generationReserveTokens: scaledGenerationReserve(
          merged.contextWindowTokens
        ),
      };
};

export const usesLlmPlanner = (
  model: ProfileTarget | null | undefined
): boolean => getModelProfile(model).webPlanner === 'llm';

export const isWebSearchReady = (
  model: ProfileTarget | null | undefined
): boolean => getModelProfile(model).webSearchReady;

export const getWebSearchMinDeviceMemoryGB = (
  model: ProfileTarget | null | undefined
): number | undefined => getModelProfile(model).webSearchMinDeviceMemoryGB;
