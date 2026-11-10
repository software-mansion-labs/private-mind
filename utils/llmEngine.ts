import { File } from 'expo-file-system';
import { wrapAsync } from 'react-native-executorch';
import {
  createChatPreprocessor,
  createLLMRunner,
  parseTokenizerConfig,
  type ChatMediaInput,
  type ChatMessage,
  type ChatPreprocessor,
  type LLMGenerationConfig,
  type LLMGenerationStats,
  type LLMMediaPreprocessorConfig,
  type LLMRunner,
  type Modality,
  type Prompt,
} from 'react-native-executorch/llm';
import type { LLMMessage as ExecutorchMessage } from '../types/llmMessage';
import { scheduleOnRN } from 'react-native-worklets';
import { decodeImageRgba } from '../modules/image-pixels';
import { toLocalPath } from './localPath';

export interface LLMEngineSources {
  modelSource: string;
  tokenizerSource: string;
  tokenizerConfigSource: string;
  vision?: boolean;
}

export interface LLMEngineGenerationConfig {
  temperature?: number;
  topP?: number;
  topp?: number;
  minP?: number;
  repetitionPenalty?: number;
  stallPassMs?: number;
  stallPassCount?: number;
}

type TokenizerConfigJson = Record<string, unknown>;

type StallWatch = { passMs: number; passCount: number };

type TurnOptions = {
  config: LLMGenerationConfig;
  stopTokens: readonly string[];
  stall: StallWatch;
  onToken: (token: string) => void;
};

type TurnResult = {
  response: string;
  stats: LLMGenerationStats;
  stalled: boolean;
};

const WIDE_TOP_K = 1000;
const DEFAULT_STALL_PASS_COUNT = 2;
const NO_STALL_WATCH: StallWatch = { passMs: 0, passCount: 1 };

const LFM_IMAGE_SHAPE = [1, 3, 512, 512] as const;
const GEMMA_IMAGE_SHAPE = [1, 3, 448, 640] as const;

const generateTurnWorklet = (
  runner: LLMRunner,
  prompt: Prompt,
  options: TurnOptions
): TurnResult => {
  'worklet';
  const { config, stopTokens, stall, onToken } = options;
  let response = '';
  let stalled = false;
  let slowPasses = 0;
  let lastPassAt = 0;

  const stats = runner.generate(prompt, config, (token) => {
    const now = Date.now();
    if (stall.passMs > 0 && lastPassAt > 0) {
      slowPasses = now - lastPassAt >= stall.passMs ? slowPasses + 1 : 0;
      if (slowPasses >= stall.passCount) {
        stalled = true;
        runner.stop();
      }
    }
    lastPassAt = now;
    if (stopTokens.includes(token)) {
      runner.stop();
      return;
    }
    response += token;
    scheduleOnRN(onToken, token);
  });

  return { response, stats, stalled };
};

const generateTurn = wrapAsync(generateTurnWorklet);

const tokenString = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  const content = (value as { content?: unknown } | null)?.content;
  return typeof content === 'string' ? content : undefined;
};

const firstToken = (config: TokenizerConfigJson, keys: string[]) =>
  keys.map((key) => tokenString(config[key])).find(Boolean);

export const visionPreprocessorFor = (
  config: TokenizerConfigJson
): LLMMediaPreprocessorConfig | undefined => {
  const start = firstToken(config, [
    'image_start_token',
    'vision_start_token',
    'boi_token',
  ]);
  const end = firstToken(config, [
    'image_end_token',
    'vision_end_token',
    'eoi_token',
  ]);
  if (!start || !end) return undefined;
  const audioStart = tokenString(config.boa_token);
  const audioEnd = tokenString(config.eoa_token);
  const isGemma = Boolean(tokenString(config.boi_token));
  return {
    image: {
      visionToken: { start, end },
      targetShape: isGemma ? GEMMA_IMAGE_SHAPE : LFM_IMAGE_SHAPE,
      preprocessorOpts: {
        resizeMode: 'letterbox',
        interpolation: 'linear',
        normalizeOpts: { alpha: 1.0, beta: 0.0 },
      },
    },
    ...(audioStart &&
      audioEnd && {
        audio: { audioToken: { start: audioStart, end: audioEnd } },
      }),
  };
};

export const modalitiesFor = (
  preprocessor: LLMMediaPreprocessorConfig | undefined
): Modality[] | undefined => {
  if (!preprocessor?.image) return undefined;
  return preprocessor.audio ? ['image', 'audio'] : ['image'];
};

const imageSideFor = (preprocessor: LLMMediaPreprocessorConfig | undefined) =>
  Math.max(...(preprocessor?.image?.targetShape.slice(-2) ?? [512]));

export const toSamplingConfig = (
  config: LLMEngineGenerationConfig
): LLMGenerationConfig => ({
  topK: WIDE_TOP_K,
  ...(config.temperature !== undefined && { temperature: config.temperature }),
  ...((config.topP ?? config.topp) !== undefined && {
    topP: config.topP ?? config.topp,
  }),
  ...(config.minP !== undefined && { minP: config.minP }),
  ...(config.repetitionPenalty !== undefined && {
    repetitionPenalty: config.repetitionPenalty,
  }),
});

export const toStallWatch = (config: LLMEngineGenerationConfig): StallWatch =>
  config.stallPassMs && config.stallPassMs > 0
    ? {
        passMs: config.stallPassMs,
        passCount: Math.max(
          1,
          config.stallPassCount ?? DEFAULT_STALL_PASS_COUNT
        ),
      }
    : NO_STALL_WATCH;

const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) =>
      typeof part === 'string'
        ? part
        : typeof part?.text === 'string'
          ? part.text
          : ''
    )
    .join('');
};

const enableThinkingFrom = (flags: Record<string, unknown>) =>
  typeof flags.enable_thinking === 'boolean'
    ? flags.enable_thinking
    : undefined;

export class LLMEngine {
  private sampling: LLMGenerationConfig = { topK: WIDE_TOP_K };
  private stall: StallWatch = NO_STALL_WATCH;
  private templateFlags: Record<string, unknown> = {};
  private generatedTokens = 0;
  private promptTokens = 0;
  private stalled = false;
  private disposed = false;

  private constructor(
    private readonly runner: LLMRunner,
    private readonly preprocessor: ChatPreprocessor,
    private readonly stopTokens: readonly string[],
    private readonly imageSide: number | null,
    private readonly onToken: (token: string) => void
  ) {}

  static async load(
    sources: LLMEngineSources,
    onToken: (token: string) => void
  ): Promise<LLMEngine> {
    const tokenizerConfigJson = JSON.parse(
      await new File(sources.tokenizerConfigSource).text()
    ) as TokenizerConfigJson;
    const { chatTemplate, bosToken, eosToken, stopTokens } =
      parseTokenizerConfig(tokenizerConfigJson);
    const preprocessorConfig = sources.vision
      ? visionPreprocessorFor(tokenizerConfigJson)
      : undefined;
    const modalities = modalitiesFor(preprocessorConfig);
    const runner = await createLLMRunner(
      toLocalPath(sources.modelSource),
      toLocalPath(sources.tokenizerSource),
      modalities
    );
    const preprocessor = createChatPreprocessor({
      chatTemplate,
      bosToken,
      eosToken,
      modalities,
      preprocessorConfig,
    });
    return new LLMEngine(
      runner,
      preprocessor,
      stopTokens,
      preprocessorConfig ? imageSideFor(preprocessorConfig) : null,
      onToken
    );
  }

  configure({
    generationConfig,
  }: {
    generationConfig?: LLMEngineGenerationConfig;
  }): void {
    if (!generationConfig) return;
    this.sampling = { ...this.sampling, ...toSamplingConfig(generationConfig) };
    this.stall = toStallWatch(generationConfig);
  }

  setChatTemplateFlags(flags: Record<string, unknown>): void {
    this.templateFlags = { ...flags };
  }

  async generate(messages: ExecutorchMessage[]): Promise<string> {
    this.generatedTokens = 0;
    this.promptTokens = 0;
    this.stalled = false;
    const history = await Promise.all(
      messages.map((message) => this.toChatMessage(message))
    );
    const prompt = this.preprocessor.process(history, history.length, {
      addGenPrompt: true,
      enableThinking: enableThinkingFrom(this.templateFlags),
    });
    const countToken = (token: string) => {
      this.generatedTokens += 1;
      this.onToken(token);
    };
    try {
      this.runner.reset();
      const { response, stats, stalled } = await generateTurn(
        this.runner,
        prompt,
        {
          config: this.sampling,
          stopTokens: this.stopTokens,
          stall: this.stall,
          onToken: countToken,
        }
      );
      this.generatedTokens = stats.numTokens;
      this.promptTokens = stats.prefill.numTokens;
      this.stalled = stalled;
      return response;
    } finally {
      this.preprocessor.clear();
    }
  }

  interrupt(): void {
    if (this.disposed) return;
    this.runner.stop();
  }

  getGeneratedTokenCount(): number {
    return this.generatedTokens;
  }

  getPromptTokensCount(): number {
    return this.promptTokens;
  }

  getMaxContextLength(): number {
    return this.runner.getKVCacheState().maxContextLen;
  }

  lastGenerationStalled(): boolean {
    return this.stalled;
  }

  delete(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.preprocessor.dispose();
    this.runner.dispose();
  }

  private async toChatMessage(
    message: ExecutorchMessage
  ): Promise<ChatMessage> {
    const text = textOf(message.content);
    if (!message.mediaPath || this.imageSide === null) {
      return { role: message.role, content: text } as ChatMessage;
    }
    const decoded = await decodeImageRgba(message.mediaPath, this.imageSide);
    const image: ChatMediaInput = {
      kind: 'image',
      image: { ...decoded, format: 'rgba', layout: 'hwc' },
    };
    return { role: message.role, content: [image, text] } as ChatMessage;
  }
}
