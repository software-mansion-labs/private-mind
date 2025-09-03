export const DEFAULT_MODELS = [
  {
    modelName: 'Qwen 3 - 0.6B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/qwen-3-0.6B/quantized/qwen3_0_6b_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer_config.json',
    parameters: 0.75,
    modelSize: 0.94,
    featured: true,
    thinking: true,
    labels: ['Fast', 'Quantized', 'Reasoning'],
  },
  {
    modelName: 'Qwen 3 - 0.6B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/qwen-3-0.6B/original/qwen3_0_6b_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer_config.json',
    parameters: 0.75,
    modelSize: 1.19,
    featured: true,
    thinking: true,
    labels: ['Balanced', 'Reasoning'],
  },
  {
    modelName: 'Qwen 3 - 1.7B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/qwen-3-1.7B/original/qwen3_1_7b_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer_config.json',
    parameters: 2.03,
    modelSize: 3.44,
    featured: true,
    thinking: true,
    labels: ['Smart', 'Reasoning'],
  },
  {
    modelName: 'Qwen 3 - 1.7B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/qwen-3-1.7B/quantized/qwen3_1_7b_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer_config.json',
    parameters: 2.03,
    modelSize: 2.16,
    featured: true,
    thinking: true,
    labels: ['Smart', 'Quantized', 'Reasoning'],
  },
  {
    modelName: 'Qwen 3 - 4B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/qwen-3-4B/original/qwen3_4b_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer_config.json',
    parameters: 4.02,
    modelSize: 8.05,
    thinking: true,
    labels: ['Smart', 'Reasoning'],
  },
  {
    modelName: 'Qwen 3 - 4B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/qwen-3-4B/quantized/qwen3_4b_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-3/resolve/v0.4.0/tokenizer_config.json',
    parameters: 4.02,
    modelSize: 3.7,
    thinking: true,
    labels: ['Smart', 'Quantized', 'Reasoning'],
  },
  {
    modelName: 'LLaMA 3.2 - 1B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-1B/original/llama3_2_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.24,
    modelSize: 2.47,
    featured: true,
    labels: ['Balanced'],
  },
  {
    modelName: 'LLaMA 3.2 - 1B - QLoRa',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-1B/QLoRA/llama3_2_qat_lora.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.24,
    modelSize: 1.18,
    featured: true,
    labels: ['Good at coding', 'Quantized'],
  },
  {
    modelName: 'LLaMA 3.2 - 1B - SpinQuant',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-1B/spinquant/llama3_2_spinquant.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.24,
    modelSize: 1.14,
    featured: true,
    labels: ['Good at coding', 'Fast', 'Great first model', 'Quantized'],
  },
  {
    modelName: 'LLaMA 3.2 - 3B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-3B/original/llama3_2_3B_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.21,
    modelSize: 6.43,
    labels: ['Good at coding'],
  },
  {
    modelName: 'LLaMA 3.2 - 3B - QLoRa',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-3B/QLoRA/llama3_2_3B_qat_lora.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.21,
    modelSize: 2.65,
    labels: ['Good at coding', 'Quantized'],
  },
  {
    modelName: 'LLaMA 3.2 - 3B - SpinQuant',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/llama-3.2-3B/spinquant/llama3_2_3B_spinquant.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-llama-3.2/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.21,
    modelSize: 2.55,
    labels: ['Good at coding', 'Fast', 'Quantized'],
  },
  {
    modelName: 'Hammer 2.1 - 0.5B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/hammer-2.1-0.5B/original/hammer2_1_0_5B_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer_config.json',
    parameters: 0.49,
    modelSize: 0.99,
    labels: ['Fast', 'Function calling'],
  },
  {
    modelName: 'Hammer 2.1 - 0.5B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/hammer-2.1-0.5B/quantized/hammer2_1_0_5B_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer_config.json',
    parameters: 0.49,
    modelSize: 0.81,
    labels: ['Fast', 'Function calling', 'Quantized'],
  },
  {
    modelName: 'Hammer 2.1 - 1.5B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/hammer-2.1-1.5B/original/hammer2_1_1_5B_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.54,
    modelSize: 3.09,
    labels: ['Balanced', 'Function calling'],
  },
  {
    modelName: 'Hammer 2.1 - 1.5B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/hammer-2.1-1.5B/quantized/hammer2_1_1_5B_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.54,
    modelSize: 1.76,
    labels: ['Balanced', 'Function calling', 'Quantized'],
  },
  {
    modelName: 'Hammer 2.1 - 3B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/hammer-2.1-3B/original/hammer2_1_3B_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.09,
    modelSize: 6.17,
    labels: ['Powerful', 'Function calling'],
  },
  {
    modelName: 'Hammer 2.1 - 3B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/hammer-2.1-3B/quantized/hammer2_1_3B_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-hammer-2.1/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.09,
    modelSize: 2.89,
    labels: ['Powerful', 'Function calling', 'Quantized'],
  },
  {
    modelName: 'Qwen 2.5 - 0.5B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/qwen-2.5-0.5B/original/qwen2_5_0_5b_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer_config.json',
    parameters: 0.49,
    modelSize: 0.99,
    labels: ['Fast', 'Small'],
  },
  {
    modelName: 'Qwen 2.5 - 0.5B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/qwen-2.5-0.5B/quantized/qwen2_5_0_5b_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer_config.json',
    parameters: 0.49,
    modelSize: 0.81,
    labels: ['Fast', 'Small'],
  },
  {
    modelName: 'Qwen 2.5 - 1.5B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/qwen-2.5-1.5B/original/qwen2_5_1_5b_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.54,
    modelSize: 3.09,
    labels: ['Balanced'],
  },
  {
    modelName: 'Qwen 2.5 - 1.5B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/qwen-2.5-1.5B/quantized/qwen2_5_1_5b_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer_config.json',
    parameters: 1.54,
    modelSize: 1.76,
    labels: ['Balanced', 'Quantized'],
  },
  {
    modelName: 'Qwen 2.5 - 3B',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/qwen-2.5-3B/original/qwen2_5_3b_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.09,
    modelSize: 6.17,
    labels: ['Powerful'],
  },
  {
    modelName: 'Qwen 2.5 - 3B - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/qwen-2.5-3B/quantized/qwen2_5_3b_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-qwen-2.5/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.09,
    modelSize: 2.89,
    labels: ['Powerful', 'Quantized'],
  },
  {
    modelName: 'PHI 4 MINI',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-phi-4-mini/resolve/v0.4.0/original/phi-4-mini_bf16.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-phi-4-mini/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-phi-4-mini/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.84,
    modelSize: 7.67,
    labels: ['Good at coding', 'Smart'],
  },
  {
    modelName: 'PHI 4 MINI - Quantized',
    modelPath:
      'https://huggingface.co/software-mansion/react-native-executorch-phi-4-mini/resolve/v0.4.0/quantized/phi-4-mini_8da4w.pte',
    tokenizerPath:
      'https://huggingface.co/software-mansion/react-native-executorch-phi-4-mini/resolve/v0.4.0/tokenizer.json',
    tokenizerConfigPath:
      'https://huggingface.co/software-mansion/react-native-executorch-phi-4-mini/resolve/v0.4.0/tokenizer_config.json',
    parameters: 3.84,
    modelSize: 4.5,
    labels: ['Good at coding', 'Quantized'],
  },
];
