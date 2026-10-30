export const FAMILY_DESCRIPTIONS: Record<string, string> = {
  'Qwen 3':
    "Alibaba's third generation of Qwen language models. The small variants here are optimized for mobile inference while keeping strong reasoning. They support an optional thinking mode for step-by-step problem solving.",
  'Qwen 2.5':
    'The previous Qwen generation, still a solid all-rounder for chat, summarization, and coding on-device. Available in several sizes so you can trade off quality against speed. Reliable pick when you want a well-rounded assistant.',
  'LLaMA 3.2':
    "Meta's LLaMA 3.2 family, released alongside the Llama 3 lineup and tuned for efficient on-device use. QLoRa and SpinQuant variants compress the model for faster inference with minimal quality loss. Good general chat and coding performance at a small footprint.",
  'LFM 2.5':
    "Liquid AI's second generation of Liquid Foundation Models, designed for edge devices. Uses a non-transformer architecture that delivers fast inference and low memory use. Vision variants can analyze images in addition to regular chat.",
  'LFM 3':
    "Liquid AI's third generation of Liquid Foundation Models, built for phones and tablets. Reasons step by step before answering and understands sixteen languages, including Polish. The VL variant can analyze images in addition to regular chat.",
  'Gemma 4':
    "Google's Gemma 4 family, adapted here for efficient on-device inference. The 2B variants keep a compact footprint while offering capable general chat, and the multimodal variant can work with images in addition to text.",
  'Bielik':
    'A Polish-language model from SpeakLeash, fine-tuned to natively understand and respond in Polish. Great for Polish-language chat, writing, and summarization tasks where other models feel clunky. Currently experimental in this app.',
};

export const FAMILY_SUMMARIES: Record<string, string> = {
  'Qwen 3': 'Alibaba · reasoning, optional thinking',
  'Qwen 2.5': 'Alibaba · chat, writing and code',
  'LLaMA 3.2': 'Meta · general chat and coding',
  'LFM 2.5': 'Liquid AI · fast, some with vision',
  'Gemma 4': 'Google · small, chat and vision',
  'Bielik': 'SpeakLeash · Polish chat and writing',
};

export const FAMILY_PROVIDERS: Record<string, string> = {
  'Qwen 3': 'Alibaba',
  'Qwen 2.5': 'Alibaba',
  'LLaMA 3.2': 'Meta',
  'LFM 2.5': 'Liquid AI',
  'Gemma 4': 'Google',
  'Bielik': 'SpeakLeash',
};
