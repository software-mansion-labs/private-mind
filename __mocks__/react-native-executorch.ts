const makeModelConstants = (name: string) => ({
  modelSource: `https://huggingface.co/mock/${name}/model.pte`,
  tokenizerSource: `https://huggingface.co/mock/${name}/tokenizer.json`,
  tokenizerConfigSource: `https://huggingface.co/mock/${name}/tokenizer_config.json`,
});

export const QWEN3_0_6B_QUANTIZED = makeModelConstants('qwen3-0.6b-quantized');
export const QWEN3_0_6B = makeModelConstants('qwen3-0.6b');
export const QWEN3_1_7B = makeModelConstants('qwen3-1.7b');
export const QWEN3_1_7B_QUANTIZED = makeModelConstants('qwen3-1.7b-quantized');
export const QWEN3_4B = makeModelConstants('qwen3-4b');
export const QWEN3_4B_QUANTIZED = makeModelConstants('qwen3-4b-quantized');
export const LLAMA3_2_1B = makeModelConstants('llama3.2-1b');
export const LLAMA3_2_1B_QLORA = makeModelConstants('llama3.2-1b-qlora');
export const LLAMA3_2_1B_SPINQUANT = makeModelConstants('llama3.2-1b-spinquant');
export const LLAMA3_2_3B = makeModelConstants('llama3.2-3b');
export const LLAMA3_2_3B_QLORA = makeModelConstants('llama3.2-3b-qlora');
export const LLAMA3_2_3B_SPINQUANT = makeModelConstants('llama3.2-3b-spinquant');
export const HAMMER2_1_0_5B = makeModelConstants('hammer2.1-0.5b');
export const HAMMER2_1_0_5B_QUANTIZED = makeModelConstants('hammer2.1-0.5b-quantized');
export const HAMMER2_1_1_5B = makeModelConstants('hammer2.1-1.5b');
export const HAMMER2_1_1_5B_QUANTIZED = makeModelConstants('hammer2.1-1.5b-quantized');
export const HAMMER2_1_3B = makeModelConstants('hammer2.1-3b');
export const HAMMER2_1_3B_QUANTIZED = makeModelConstants('hammer2.1-3b-quantized');
export const QWEN2_5_0_5B = makeModelConstants('qwen2.5-0.5b');
export const QWEN2_5_0_5B_QUANTIZED = makeModelConstants('qwen2.5-0.5b-quantized');
export const QWEN2_5_1_5B = makeModelConstants('qwen2.5-1.5b');
export const QWEN2_5_1_5B_QUANTIZED = makeModelConstants('qwen2.5-1.5b-quantized');
export const QWEN2_5_3B = makeModelConstants('qwen2.5-3b');
export const QWEN2_5_3B_QUANTIZED = makeModelConstants('qwen2.5-3b-quantized');
export const PHI_4_MINI_4B = makeModelConstants('phi4-mini-4b');
export const PHI_4_MINI_4B_QUANTIZED = makeModelConstants('phi4-mini-4b-quantized');
export const LFM2_5_1_2B_INSTRUCT = makeModelConstants('lfm2.5-1.2b-instruct');
export const LFM2_5_1_2B_INSTRUCT_QUANTIZED = makeModelConstants('lfm2.5-1.2b-instruct-quantized');
export const LFM2_VL_1_6B_QUANTIZED = makeModelConstants('lfm2-vl-1.6b-quantized');
export const WHISPER_TINY_EN = 'whisper-tiny-en';

export const LLMModule = {
  fromCustomModel: jest.fn(),
};

export const SpeechToTextModule = {
  fromModelName: jest.fn(),
};

export const TextEmbeddingsModule = {
  fromCustomModel: jest.fn(),
};

export const ResourceFetcher = {
  fetch: jest.fn(),
};
