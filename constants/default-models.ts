import { Platform } from 'react-native';
import { type Model } from '../database/modelRepository';
import {
  DEFAULT_PROFILE,
  getModelProfile,
  type ProfileTarget,
} from './model-profiles';
import {
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
  LLAMA3_2_1B_QLORA,
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_3B_QLORA,
  LLAMA3_2_3B_SPINQUANT,
  QWEN2_5_0_5B_QUANTIZED,
  QWEN2_5_1_5B_QUANTIZED,
  QWEN2_5_3B_QUANTIZED,
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  LFM2_5_VL_1_6B_QUANTIZED,
  LFM2_5_VL_450M_QUANTIZED,
  BIELIK_V3_0_1_5B_QUANTIZED,
  GEMMA4_E2B,
  GEMMA4_E2B_MM,
} from 'react-native-executorch';

export const getStartingModels = (deviceRamInGB: number): string[] => {
  if (deviceRamInGB < 4) {
    return ['Qwen 3 - 0.6B', 'LFM 2.5 VL - 450M', 'LFM 2.5 - 1.2B'];
  }

  if (deviceRamInGB <= 6) {
    return ['Qwen 3 - 1.7B', 'LFM 2.5 - 1.2B', 'LFM 2.5 VL - 1.6B'];
  }

  return ['Gemma 4 - 2B', 'Gemma 4 VL - 2B', 'Qwen 3 - 1.7B'];
};

const RNE_MODELS = [
  QWEN3_0_6B_QUANTIZED,
  QWEN3_1_7B_QUANTIZED,
  LLAMA3_2_1B_QLORA,
  LLAMA3_2_1B_SPINQUANT,
  LLAMA3_2_3B_QLORA,
  LLAMA3_2_3B_SPINQUANT,
  QWEN2_5_0_5B_QUANTIZED,
  QWEN2_5_1_5B_QUANTIZED,
  QWEN2_5_3B_QUANTIZED,
  LFM2_5_1_2B_INSTRUCT_QUANTIZED,
  LFM2_5_VL_1_6B_QUANTIZED,
  LFM2_5_VL_450M_QUANTIZED,
  BIELIK_V3_0_1_5B_QUANTIZED,
  GEMMA4_E2B,
  GEMMA4_E2B_MM,
];

const GENERATION_CONFIG_BY_MODEL_PATH: Record<string, object> =
  Object.fromEntries(
    RNE_MODELS.flatMap((m) =>
      m && 'generationConfig' in m && m.generationConfig
        ? [[m.modelSource, m.generationConfig]]
        : []
    )
  );

export const DEFAULT_REPETITION_PENALTY = DEFAULT_PROFILE.repetitionPenalty;

/**
 * ExecuTorch applies `repetitionPenalty` over the whole prompt, once per
 * occurrence (`common/runner/text_token_generator.h` seeds it with the prefill
 * tokens), so any penalty above 1 suppresses exactly the words a grounded
 * answer has to quote.
 */
export const GROUNDED_REPETITION_PENALTY = 1;

export const getGenerationConfigForModel = (
  model: ProfileTarget & Pick<Model, 'modelPath'>,
  grounded: boolean = false
) => ({
  repetitionPenalty: getModelProfile(model).repetitionPenalty,
  ...GENERATION_CONFIG_BY_MODEL_PATH[model.modelPath],
  ...(grounded ? { repetitionPenalty: GROUNDED_REPETITION_PENALTY } : {}),
});

export const DEFAULT_MODELS: Omit<Model, 'id' | 'isDownloaded'>[] = [
  {
    modelName: 'Qwen 3 - 0.6B',
    family: 'Qwen 3',
    tokenizerPath: QWEN3_0_6B_QUANTIZED.tokenizerSource,
    modelPath: QWEN3_0_6B_QUANTIZED.modelSource,
    tokenizerConfigPath: QWEN3_0_6B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 0.75,
    modelSize: 0.94,
    featured: true,
    thinking: true,
    labels: ['Fast', 'Reasoning'],
  },
  {
    modelName: 'Qwen 3 - 1.7B',
    family: 'Qwen 3',
    tokenizerPath: QWEN3_1_7B_QUANTIZED.tokenizerSource,
    modelPath: QWEN3_1_7B_QUANTIZED.modelSource,
    tokenizerConfigPath: QWEN3_1_7B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 2.03,
    modelSize: 2.16,
    featured: true,
    thinking: true,
    labels: ['Smart', 'Reasoning'],
  },
  {
    modelName: 'LLaMA 3.2 - 1B - QLoRa',
    family: 'LLaMA 3.2',
    tokenizerPath: LLAMA3_2_1B_QLORA.tokenizerSource,
    modelPath: LLAMA3_2_1B_QLORA.modelSource,
    tokenizerConfigPath: LLAMA3_2_1B_QLORA.tokenizerConfigSource,
    source: 'remote',
    parameters: 1.24,
    modelSize: 1.18,
    featured: true,
    labels: ['Good at coding'],
  },
  {
    modelName: 'LLaMA 3.2 - 1B - SpinQuant',
    family: 'LLaMA 3.2',
    tokenizerPath: LLAMA3_2_1B_SPINQUANT.tokenizerSource,
    modelPath: LLAMA3_2_1B_SPINQUANT.modelSource,
    tokenizerConfigPath: LLAMA3_2_1B_SPINQUANT.tokenizerConfigSource,
    source: 'remote',
    parameters: 1.24,
    modelSize: 1.14,
    featured: true,
    labels: ['Good at coding', 'Fast', 'Great first model'],
  },
  {
    modelName: 'LLaMA 3.2 - 3B - QLoRa',
    family: 'LLaMA 3.2',
    tokenizerPath: LLAMA3_2_3B_QLORA.tokenizerSource,
    modelPath: LLAMA3_2_3B_QLORA.modelSource,
    tokenizerConfigPath: LLAMA3_2_3B_QLORA.tokenizerConfigSource,
    source: 'remote',
    parameters: 3.21,
    modelSize: 2.65,
    featured: true,
    labels: ['Good at coding'],
  },
  {
    modelName: 'LLaMA 3.2 - 3B - SpinQuant',
    family: 'LLaMA 3.2',
    tokenizerPath: LLAMA3_2_3B_SPINQUANT.tokenizerSource,
    modelPath: LLAMA3_2_3B_SPINQUANT.modelSource,
    tokenizerConfigPath: LLAMA3_2_3B_SPINQUANT.tokenizerConfigSource,
    source: 'remote',
    parameters: 3.21,
    modelSize: 2.55,
    featured: true,
    labels: ['Good at coding', 'Fast'],
  },
  {
    modelName: 'Qwen 2.5 - 0.5B',
    family: 'Qwen 2.5',
    tokenizerPath: QWEN2_5_0_5B_QUANTIZED.tokenizerSource,
    modelPath: QWEN2_5_0_5B_QUANTIZED.modelSource,
    tokenizerConfigPath: QWEN2_5_0_5B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 0.49,
    modelSize: 0.81,
    featured: true,
    labels: ['Fast', 'Small'],
  },
  {
    modelName: 'Qwen 2.5 - 1.5B',
    family: 'Qwen 2.5',
    tokenizerPath: QWEN2_5_1_5B_QUANTIZED.tokenizerSource,
    modelPath: QWEN2_5_1_5B_QUANTIZED.modelSource,
    tokenizerConfigPath: QWEN2_5_1_5B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 1.54,
    modelSize: 1.76,
    featured: true,
    labels: ['Balanced'],
  },
  {
    modelName: 'Qwen 2.5 - 3B',
    family: 'Qwen 2.5',
    tokenizerPath: QWEN2_5_3B_QUANTIZED.tokenizerSource,
    modelPath: QWEN2_5_3B_QUANTIZED.modelSource,
    tokenizerConfigPath: QWEN2_5_3B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 3.09,
    modelSize: 2.89,
    featured: true,
    labels: ['Powerful'],
  },
  {
    modelName: 'LFM 2.5 - 1.2B',
    family: 'LFM 2.5',
    tokenizerPath: LFM2_5_1_2B_INSTRUCT_QUANTIZED.tokenizerSource,
    modelPath: LFM2_5_1_2B_INSTRUCT_QUANTIZED.modelSource,
    tokenizerConfigPath: LFM2_5_1_2B_INSTRUCT_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 1.2,
    modelSize: 1.14,
    featured: true,
    labels: ['Balanced'],
  },
  {
    modelName: 'LFM 2.5 VL - 1.6B',
    family: 'LFM 2.5',
    modelPath: LFM2_5_VL_1_6B_QUANTIZED.modelSource,
    tokenizerPath: LFM2_5_VL_1_6B_QUANTIZED.tokenizerSource,
    tokenizerConfigPath: LFM2_5_VL_1_6B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 1.6,
    modelSize: 2.43,
    featured: true,
    thinking: false,
    vision: true,
    labels: ['Vision'],
    systemPrompt:
      'You are a helpful vision assistant. When the user shares an image, analyze it carefully and provide detailed, accurate descriptions and answers about its content. When no image is provided, respond as a knowledgeable and helpful general assistant.',
  },
  {
    modelName: 'LFM 2.5 VL - 450M',
    family: 'LFM 2.5',
    modelPath: LFM2_5_VL_450M_QUANTIZED.modelSource,
    tokenizerPath: LFM2_5_VL_450M_QUANTIZED.tokenizerSource,
    tokenizerConfigPath: LFM2_5_VL_450M_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 0.45,
    modelSize: 0.65,
    featured: true,
    thinking: false,
    vision: true,
    labels: ['Fast', 'Vision'],
    systemPrompt:
      'You are a helpful vision assistant. When the user shares an image, analyze it carefully and provide detailed, accurate descriptions and answers about its content. When no image is provided, respond as a knowledgeable and helpful general assistant.',
  },
  {
    modelName: 'Bielik - v3.0',
    family: 'Bielik',
    tokenizerPath: BIELIK_V3_0_1_5B_QUANTIZED.tokenizerSource,
    modelPath: BIELIK_V3_0_1_5B_QUANTIZED.modelSource,
    tokenizerConfigPath: BIELIK_V3_0_1_5B_QUANTIZED.tokenizerConfigSource,
    source: 'remote',
    parameters: 1.5,
    modelSize: 0.86,
    featured: true,
    experimental: true,
    thinking: false,
    labels: ['Fast', 'Polish'],
    systemPrompt:
      'Jesteś pomocnym asystentem. Udzielaj jasnych, dokładnych i dobrze ustrukturyzowanych odpowiedzi w języku polskim. Gdy otrzymasz kontekst z dokumentów, wykorzystaj te informacje, aby udzielać wyczerpujących odpowiedzi, będąc jednocześnie zwięzłym i rzeczowym.',
  },
  {
    modelName: 'Gemma 4 - 2B',
    family: 'Gemma 4',
    tokenizerPath: GEMMA4_E2B.tokenizerSource,
    modelPath: GEMMA4_E2B.modelSource,
    tokenizerConfigPath: GEMMA4_E2B.tokenizerConfigSource,
    source: 'remote',
    parameters: 2.0,
    modelSize: Platform.OS === 'android' ? 2.5 : 2.9,
    featured: true,
    thinking: false,
    labels: ['Balanced'],
  },
  {
    modelName: 'Gemma 4 VL - 2B',
    family: 'Gemma 4',
    tokenizerPath: GEMMA4_E2B_MM.tokenizerSource,
    modelPath: GEMMA4_E2B_MM.modelSource,
    tokenizerConfigPath: GEMMA4_E2B_MM.tokenizerConfigSource,
    source: 'remote',
    parameters: 2.0,
    modelSize: Platform.OS === 'android' ? 4.0 : 3.0,
    featured: true,
    thinking: false,
    vision: true,
    labels: ['Capable'],
    systemPrompt:
      'You are a helpful vision assistant. When the user shares an image, analyze it carefully and provide detailed, accurate descriptions and answers about its content. When no image is provided, respond as a knowledgeable and helpful general assistant.',
  },
];
