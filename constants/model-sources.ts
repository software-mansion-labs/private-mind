import { Platform } from 'react-native';

type PerPlatform = string | { ios: string; android: string };

type ModelSources = {
  modelSource: PerPlatform;
  tokenizerSource: PerPlatform;
  tokenizerConfigSource: PerPlatform;
};

const HF = 'https://huggingface.co/software-mansion/';

export const RNE_0_11_SOURCES: Record<string, ModelSources> = {
  'qwen3-0.6b-quantized': {
    modelSource: `${HF}Qwen3-ExecuTorch/resolve/v0.11.0/0_6b/xnnpack/qwen_3_0_6b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}Qwen3-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Qwen3-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'qwen3-1.7b-quantized': {
    modelSource: `${HF}Qwen3-ExecuTorch/resolve/v0.11.0/1_7b/xnnpack/qwen_3_1_7b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}Qwen3-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Qwen3-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'llama-3.2-1b-spinquant': {
    modelSource: `${HF}Llama-3.2-ExecuTorch/resolve/v0.11.0/1b/xnnpack/llama_3_2_1b_xnnpack_spinquant.pte`,
    tokenizerSource: `${HF}Llama-3.2-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Llama-3.2-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'llama-3.2-3b-spinquant': {
    modelSource: `${HF}Llama-3.2-ExecuTorch/resolve/v0.11.0/3b/xnnpack/llama_3_2_3b_xnnpack_spinquant.pte`,
    tokenizerSource: `${HF}Llama-3.2-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Llama-3.2-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'qwen2.5-0.5b-quantized': {
    modelSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/0_5b/xnnpack/qwen_2_5_0_5b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'qwen2.5-1.5b-quantized': {
    modelSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/1_5b/xnnpack/qwen_2_5_1_5b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'qwen2.5-3b-quantized': {
    modelSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/3b/xnnpack/qwen_2_5_3b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Qwen2.5-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'lfm2.5-1.2b-instruct-quantized': {
    modelSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/1_2b/xnnpack/lfm_2_5_1_2b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/1_2b/tokenizer.json`,
    tokenizerConfigSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/1_2b/tokenizer_config.json`,
  },
  'lfm2.5-vl-1.6b-quantized': {
    modelSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/vl_1_6b/xnnpack/lfm_2_5_vl_1_6b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/vl_1_6b/tokenizer.json`,
    tokenizerConfigSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/vl_1_6b/tokenizer_config.json`,
  },
  'lfm2.5-vl-450m-quantized': {
    modelSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/vl_450m/xnnpack/lfm_2_5_vl_450m_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/vl_450m/tokenizer.json`,
    tokenizerConfigSource: `${HF}LFM2.5-ExecuTorch/resolve/v0.11.0/vl_450m/tokenizer_config.json`,
  },
  'bielik-v3.0-1.5b-quantized': {
    modelSource: `${HF}Bielik-1.5B-v3.0-Instruct-ExecuTorch/resolve/v0.11.0/xnnpack/bielik_v3_0_1_5b_xnnpack_8da4w.pte`,
    tokenizerSource: `${HF}Bielik-1.5B-v3.0-Instruct-ExecuTorch/resolve/v0.11.0/tokenizer.json`,
    tokenizerConfigSource: `${HF}Bielik-1.5B-v3.0-Instruct-ExecuTorch/resolve/v0.11.0/tokenizer_config.json`,
  },
  'gemma4-e2b': {
    modelSource: {
      ios: `${HF}gemma-4-E2B-it-text-ExecuTorch/resolve/v0.11.0/e2b/mlx/gemma_4_e2b_mlx_int4.pte`,
      android: `${HF}gemma-4-E2B-it-text-ExecuTorch/resolve/v0.11.0/e2b/vulkan/gemma_4_e2b_vulkan_8da4w.pte`,
    },
    tokenizerSource: `${HF}gemma-4-E2B-it-text-ExecuTorch/resolve/v0.11.0/e2b/tokenizer.json`,
    tokenizerConfigSource: `${HF}gemma-4-E2B-it-text-ExecuTorch/resolve/v0.11.0/e2b/tokenizer_config.json`,
  },
  'gemma4-e2b-multimodal': {
    modelSource: {
      ios: `${HF}gemma-4-E2B-it-ExecuTorch/resolve/v0.11.0/e2b/mlx/gemma_4_e2b_mlx_int4.pte`,
      android: `${HF}gemma-4-E2B-it-ExecuTorch/resolve/v1.0.0/e2b/vulkan/gemma_4_e2b_vulkan_8da4w.pte`,
    },
    tokenizerSource: `${HF}gemma-4-E2B-it-ExecuTorch/resolve/v0.11.0/e2b/tokenizer.json`,
    tokenizerConfigSource: `${HF}gemma-4-E2B-it-ExecuTorch/resolve/v0.11.0/e2b/tokenizer_config.json`,
  },
};

const forThisPlatform = (source: PerPlatform): string => {
  if (typeof source === 'string') return source;
  return Platform.OS === 'ios' ? source.ios : source.android;
};

export const onRne011 = <M extends { modelName: string }>(model: M) => {
  const sources = RNE_0_11_SOURCES[model.modelName];
  if (!sources) {
    throw new Error(`No RNE 0.11 export is listed for ${model.modelName}`);
  }
  return {
    ...model,
    modelSource: forThisPlatform(sources.modelSource),
    tokenizerSource: forThisPlatform(sources.tokenizerSource),
    tokenizerConfigSource: forThisPlatform(sources.tokenizerConfigSource),
  };
};
