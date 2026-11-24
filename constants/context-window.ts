import { type Model } from '../database/modelRepository';
import { getModelProfile, scaledGenerationReserve } from './model-profiles';

const TOKENS_PER_CHAR = {
  cjk: 1.0,
  denseAbugida: 0.6,
  rtlAndIndic: 0.5,
  nonLatinAlphabet: 0.5,
  latinAccented: 0.5,
  digit: 0.5,
  punctuation: 0.4,
  latin: 0.25,
  other: 1.0,
} as const;

const DEFAULT_TOKENS_PER_CHAR = 1 / 3;

export const getContextWindowTokens = (model: Model): number =>
  getModelProfile(model).contextWindowTokens;

const tokensForCodePoint = (code: number): number => {
  if (
    (code >= 0x3040 && code <= 0x30ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x20000 && code <= 0x3134f)
  ) {
    return TOKENS_PER_CHAR.cjk;
  }
  if (
    (code >= 0x0e00 && code <= 0x0eff) ||
    (code >= 0x1000 && code <= 0x109f) ||
    (code >= 0x1780 && code <= 0x17ff)
  ) {
    return TOKENS_PER_CHAR.denseAbugida;
  }
  if (
    (code >= 0x0590 && code <= 0x08ff) ||
    (code >= 0x0900 && code <= 0x0dff)
  ) {
    return TOKENS_PER_CHAR.rtlAndIndic;
  }
  if (
    (code >= 0x0370 && code <= 0x058f) ||
    (code >= 0x10a0 && code <= 0x10ff)
  ) {
    return TOKENS_PER_CHAR.nonLatinAlphabet;
  }
  if (code >= 0x00c0 && code <= 0x036f) {
    return TOKENS_PER_CHAR.latinAccented;
  }
  if (code >= 0x30 && code <= 0x39) return TOKENS_PER_CHAR.digit;
  if (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    code === 0x20 ||
    code === 0x0a ||
    code === 0x09
  ) {
    return TOKENS_PER_CHAR.latin;
  }
  if (code < 0x80) return TOKENS_PER_CHAR.punctuation;
  return TOKENS_PER_CHAR.other;
};

export const estimateCharTokens = (char: string): number =>
  tokensForCodePoint(char.codePointAt(0)!);

export const estimatePromptTokens = (text: string): number => {
  let tokens = 0;
  for (const char of text) {
    tokens += estimateCharTokens(char);
  }
  return Math.ceil(tokens);
};

export const getPromptTokenBudget = (model: Model): number => {
  const profile = getModelProfile(model);
  return Math.max(
    0,
    profile.contextWindowTokens - profile.generationReserveTokens
  );
};

export const PROMPT_TOKEN_SAFETY = 0.85;

const charBudgetForTokens = (promptTokens: number, sample?: string): number => {
  const tokenBudget = Math.floor(promptTokens * PROMPT_TOKEN_SAFETY);
  if (!sample || sample.length === 0) {
    return Math.floor(tokenBudget / DEFAULT_TOKENS_PER_CHAR);
  }
  const density = estimatePromptTokens(sample) / sample.length;
  return Math.max(0, Math.floor((tokenBudget - 1) / density));
};

export const getPromptCharBudget = (model: Model, sample?: string): number =>
  charBudgetForTokens(getPromptTokenBudget(model), sample);

export const EXTENDED_CONTEXT_WINDOW_TOKENS = 4096;
export const EXTENDED_WINDOW_MIN_DEVICE_RAM_GB = 6;
export const LARGE_CONTEXT_WINDOW_TOKENS = 8192;
export const LARGE_WINDOW_MIN_DEVICE_RAM_GB = 8;
const SOURCE_SHARE_OF_EXTRA_ROOM = 0.5;

export type ConversationMemory = 'low' | 'medium' | 'high' | 'auto';
export const DEFAULT_CONVERSATION_MEMORY: ConversationMemory = 'auto';
export const CONVERSATION_MEMORY_LEVELS: readonly ConversationMemory[] = [
  'low',
  'medium',
  'high',
  'auto',
];

const isConversationMemory = (value: unknown): value is ConversationMemory =>
  CONVERSATION_MEMORY_LEVELS.some((level) => level === value);

export const sanitizeConversationMemory = (
  value: unknown
): ConversationMemory =>
  isConversationMemory(value) ? value : DEFAULT_CONVERSATION_MEMORY;

export interface ConversationWindowInput {
  thinking: boolean;
  deviceRamGB: number;
  modelCapacityTokens?: number;
  memory?: ConversationMemory;
  carriesSources?: boolean;
  ceilingTokens?: number;
  modelFitsDevice?: boolean;
}

const isLargeWindowAvailable = (deviceRamGB: number): boolean =>
  Math.ceil(deviceRamGB) >= LARGE_WINDOW_MIN_DEVICE_RAM_GB;

const largeWindowReachable = ({
  deviceRamGB,
  modelFitsDevice = false,
}: ConversationWindowInput): boolean =>
  modelFitsDevice && isLargeWindowAvailable(deviceRamGB);

const extendedCeilingFor = (input: ConversationWindowInput): number => {
  const { ceilingTokens, memory = DEFAULT_CONVERSATION_MEMORY } = input;
  const autoWantsLarge =
    memory === 'auto' &&
    ceilingTokens === LARGE_CONTEXT_WINDOW_TOKENS &&
    isLargeWindowAvailable(input.deviceRamGB);
  const highWantsLarge = memory === 'high' && largeWindowReachable(input);
  return autoWantsLarge || highWantsLarge
    ? LARGE_CONTEXT_WINDOW_TOKENS
    : EXTENDED_CONTEXT_WINDOW_TOKENS;
};

export const isExtendedWindowAvailable = (deviceRamGB: number): boolean =>
  Math.ceil(deviceRamGB) >= EXTENDED_WINDOW_MIN_DEVICE_RAM_GB;

export const getConversationWindowTokens = (
  model: Model,
  input: ConversationWindowInput
): number => {
  const {
    thinking,
    deviceRamGB,
    modelCapacityTokens,
    memory = DEFAULT_CONVERSATION_MEMORY,
  } = input;
  const base = getContextWindowTokens(model);
  if (memory === 'low') return base;
  if (
    thinking ||
    modelCapacityTokens === undefined ||
    !isExtendedWindowAvailable(deviceRamGB)
  ) {
    return base;
  }
  return Math.max(
    base,
    Math.min(extendedCeilingFor(input), modelCapacityTokens)
  );
};

export const getConversationTokenBudget = (
  model: Model,
  input: ConversationWindowInput
): number => {
  const window = getConversationWindowTokens(model, input);
  if (window === getContextWindowTokens(model)) {
    return getPromptTokenBudget(model);
  }
  return Math.max(0, window - scaledGenerationReserve(window));
};

export const GROUNDED_ANSWER_TOKEN_LIMIT = 1024;

export const getAnswerTokenLimit = (
  model: Model,
  input: ConversationWindowInput,
  promptTokens: number
): number | undefined => {
  if (input.thinking) return undefined;
  const window = getConversationWindowTokens(model, input);
  const reserve = window - getConversationTokenBudget(model, input);
  const room = Math.max(reserve, window - promptTokens);
  return input.carriesSources
    ? Math.min(room, GROUNDED_ANSWER_TOKEN_LIMIT)
    : room;
};

export const getConversationCharBudget = (
  model: Model,
  input: ConversationWindowInput,
  sample?: string
): number =>
  charBudgetForTokens(getConversationTokenBudget(model, input), sample);

export const getSourceTokenBudget = (
  model: Model,
  input: ConversationWindowInput
): number => {
  const base = getPromptTokenBudget(model);
  const conversation = getConversationTokenBudget(model, {
    ...input,
    carriesSources: true,
  });
  if (conversation <= base) return base;
  return base + Math.floor((conversation - base) * SOURCE_SHARE_OF_EXTRA_ROOM);
};

export const getSourceCharBudget = (
  model: Model,
  input: ConversationWindowInput,
  sample?: string
): number => charBudgetForTokens(getSourceTokenBudget(model, input), sample);

export const hasExtendedSourceRoom = (
  model: Model,
  input: ConversationWindowInput
): boolean => getSourceTokenBudget(model, input) > getPromptTokenBudget(model);

export type SourceRoom = 'standard' | 'adaptive' | 'full';

export const sourceRoomFor = (
  model: Model,
  input: ConversationWindowInput
): SourceRoom => {
  if (!hasExtendedSourceRoom(model, input)) return 'standard';
  return input.memory === 'auto' ? 'adaptive' : 'full';
};
