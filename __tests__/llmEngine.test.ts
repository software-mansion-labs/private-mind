import {
  createChatPreprocessor,
  createLLMRunner,
  parseTokenizerConfig,
} from 'react-native-executorch/llm';
import {
  LLMEngine,
  modalitiesFor,
  toSamplingConfig,
  toStallWatch,
  visionPreprocessorFor,
} from '../utils/llmEngine';
import { writtenFiles } from '../__mocks__/expo-file-system';
import { decodeImageRgba } from '../modules/image-pixels';

jest.mock('../modules/image-pixels', () => ({
  decodeImageRgba: jest.fn(async () => ({
    width: 2,
    height: 1,
    data: new Uint8Array(8),
  })),
}));

const TOKENIZER_CONFIG = 'file:///documents/react-native-executorch/cfg.json';

const stats = (numTokens: number, promptTokens: number) => ({
  numTokens,
  durationMs: 10,
  tokensPerSecond: 1,
  prefill: { numTokens: promptTokens, durationMs: 5, tokensPerSecond: 1 },
});

const makeRunner = (emit: (onToken: (token: string) => void) => void) => ({
  modelPath: 'model.pte',
  tokenizerPath: 'tokenizer.json',
  modalities: [],
  dispose: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
  getKVCacheState: jest.fn(() => ({
    pos: 0,
    maxContextLen: 16384,
    remainingTokens: 16384,
    usageRatio: 0,
  })),
  prefill: jest.fn(),
  generate: jest.fn(
    (_prompt: unknown, _config: unknown, onToken: (t: string) => void) => {
      emit(onToken);
      return stats(3, 1900);
    }
  ),
});

const preprocessor = {
  dispose: jest.fn(),
  clear: jest.fn(),
  process: jest.fn(() => 'rendered prompt'),
  render: jest.fn(),
  buildPrompt: jest.fn(),
};

const loadEngine = async (
  runner: ReturnType<typeof makeRunner>,
  onToken: (token: string) => void = () => {},
  vision = false
) => {
  (createLLMRunner as jest.Mock).mockResolvedValueOnce(runner);
  (createChatPreprocessor as jest.Mock).mockReturnValueOnce(preprocessor);
  return LLMEngine.load(
    {
      modelSource: 'file:///documents/react-native-executorch/my%20model.pte',
      tokenizerSource: 'file:///documents/react-native-executorch/tok.json',
      tokenizerConfigSource: TOKENIZER_CONFIG,
      vision,
    },
    onToken
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  writtenFiles.set(
    TOKENIZER_CONFIG,
    JSON.stringify({
      chat_template: '{{ messages }}',
      eos_token: '<|im_end|>',
      image_start_token: '<|image_start|>',
      image_end_token: '<|image_end|>',
    })
  );
  (parseTokenizerConfig as jest.Mock).mockReturnValue({
    chatTemplate: '{{ messages }}',
    eosToken: '<|im_end|>',
    stopTokens: ['<|im_end|>'],
  });
});

describe('LLMEngine', () => {
  it('hands the runner plain file paths, because the native loader cannot open file:// URIs', async () => {
    await loadEngine(makeRunner(() => {}));
    expect(createLLMRunner).toHaveBeenCalledWith(
      '/documents/react-native-executorch/my model.pte',
      '/documents/react-native-executorch/tok.json',
      undefined
    );
  });

  it('reads the context length from the model file through the runner', async () => {
    const engine = await loadEngine(makeRunner(() => {}));
    expect(engine.getMaxContextLength()).toBe(16384);
  });

  it('starts every turn from an empty KV cache and returns the streamed answer', async () => {
    const streamed: string[] = [];
    const runner = makeRunner((onToken) => {
      onToken('Hel');
      onToken('lo');
    });
    const engine = await loadEngine(runner, (token) => streamed.push(token));
    const answer = await engine.generate([{ role: 'user', content: 'hi' }]);
    expect(runner.reset).toHaveBeenCalledWith();
    expect(answer).toBe('Hello');
    expect(streamed).toEqual(['Hel', 'lo']);
    expect(engine.getGeneratedTokenCount()).toBe(3);
    expect(engine.getPromptTokensCount()).toBe(1900);
    expect(preprocessor.clear).toHaveBeenCalled();
  });

  it('passes the thinking switch to the chat template', async () => {
    const engine = await loadEngine(makeRunner(() => {}));
    engine.setChatTemplateFlags({ enable_thinking: false });
    await engine.generate([{ role: 'user', content: 'hi' }]);
    expect(preprocessor.process).toHaveBeenCalledWith(expect.any(Array), 1, {
      addGenPrompt: true,
      enableThinking: false,
    });
  });

  it('stops on a stop token without streaming it', async () => {
    const runner = makeRunner((onToken) => {
      onToken('Done');
      onToken('<|im_end|>');
    });
    const engine = await loadEngine(runner);
    expect(await engine.generate([{ role: 'user', content: 'hi' }])).toBe(
      'Done'
    );
    expect(runner.stop).toHaveBeenCalled();
  });

  it('reports a stall once enough consecutive passes run over the limit', async () => {
    const now = jest.spyOn(Date, 'now');
    [1000, 5000, 9000, 13000].forEach((t) => now.mockReturnValueOnce(t));
    const runner = makeRunner((onToken) => {
      ['a', 'b', 'c', 'd'].forEach(onToken);
    });
    const engine = await loadEngine(runner);
    engine.configure({
      generationConfig: { stallPassMs: 3000, stallPassCount: 3 },
    });
    await engine.generate([{ role: 'user', content: 'hi' }]);
    expect(engine.lastGenerationStalled()).toBe(true);
    expect(runner.stop).toHaveBeenCalled();
    now.mockRestore();
  });

  it('does not report a stall when a fast pass breaks the slow run', async () => {
    const now = jest.spyOn(Date, 'now');
    [1000, 5000, 5100, 9100].forEach((t) => now.mockReturnValueOnce(t));
    const runner = makeRunner((onToken) => {
      ['a', 'b', 'c', 'd'].forEach(onToken);
    });
    const engine = await loadEngine(runner);
    engine.configure({
      generationConfig: { stallPassMs: 3000, stallPassCount: 2 },
    });
    await engine.generate([{ role: 'user', content: 'hi' }]);
    expect(engine.lastGenerationStalled()).toBe(false);
    now.mockRestore();
  });

  it('turns a message with an image into image and text content', async () => {
    const engine = await loadEngine(
      makeRunner(() => {}),
      () => {},
      true
    );
    await engine.generate([
      { role: 'user', content: 'What is this?', mediaPath: 'file:///a.jpg' },
    ]);
    expect(decodeImageRgba).toHaveBeenCalledWith('file:///a.jpg', 512);
    const [history] = (preprocessor.process as jest.Mock).mock.calls[0];
    expect(history[0].content).toEqual([
      {
        kind: 'image',
        image: expect.objectContaining({ format: 'rgba', width: 2 }),
      },
      'What is this?',
    ]);
  });

  it('does not stop a runner it already released', async () => {
    const runner = makeRunner(() => {});
    const engine = await loadEngine(runner);
    engine.delete();
    engine.interrupt();
    engine.delete();
    expect(runner.stop).not.toHaveBeenCalled();
    expect(runner.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('toSamplingConfig', () => {
  it('keeps the app sampling and widens top-k so it no longer cuts the nucleus', () => {
    expect(
      toSamplingConfig({
        temperature: 0.7,
        topp: 0.8,
        minP: 0,
        repetitionPenalty: 1.1,
      })
    ).toEqual({
      topK: 1000,
      temperature: 0.7,
      topP: 0.8,
      minP: 0,
      repetitionPenalty: 1.1,
    });
  });
});

describe('toStallWatch', () => {
  it('is off unless a pass limit is set', () => {
    expect(toStallWatch({ temperature: 1 }).passMs).toBe(0);
  });

  it('defaults to two slow passes like the patched legacy runner', () => {
    expect(toStallWatch({ stallPassMs: 3000 })).toEqual({
      passMs: 3000,
      passCount: 2,
    });
  });
});

describe('visionPreprocessorFor', () => {
  it('uses the LFM 2.5 VL image delimiters', () => {
    const config = visionPreprocessorFor({
      image_start_token: '<|image_start|>',
      image_end_token: '<|image_end|>',
    });
    expect(config?.image?.visionToken).toEqual({
      start: '<|image_start|>',
      end: '<|image_end|>',
    });
    expect(modalitiesFor(config)).toEqual(['image']);
  });

  it('uses the LFM 3 VL vision delimiters', () => {
    expect(
      visionPreprocessorFor({
        vision_start_token: '<|vision_start|>',
        vision_end_token: '<|vision_end|>',
      })?.image?.visionToken
    ).toEqual({ start: '<|vision_start|>', end: '<|vision_end|>' });
  });

  it('gives Gemma its own image delimiters and shape, and the audio its runner requires', () => {
    const config = visionPreprocessorFor({
      boi_token: '<|image>',
      eoi_token: '<image|>',
      boa_token: '<|audio>',
      eoa_token: '<audio|>',
    });
    expect(modalitiesFor(config)).toEqual(['image', 'audio']);
    expect(config?.image?.visionToken).toEqual({
      start: '<|image>',
      end: '<image|>',
    });
    expect(config?.image?.targetShape).toEqual([1, 3, 448, 640]);
  });

  it('has nothing for a tokenizer without image delimiters', () => {
    expect(visionPreprocessorFor({ eos_token: '</s>' })).toBeUndefined();
  });
});
