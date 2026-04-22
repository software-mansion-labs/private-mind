export const FAMILY_DESCRIPTIONS: Record<string, string> = {
  'Qwen 3':
    "Alibaba's third generation of Qwen language models. The small variants here are optimized for mobile inference while keeping strong reasoning. They support an optional thinking mode for step-by-step problem solving.",
  'Qwen 2.5':
    'The previous Qwen generation, still a solid all-rounder for chat, summarization, and coding on-device. Available in several sizes so you can trade off quality against speed. Reliable pick when you want a well-rounded assistant.',
  'LLaMA 3.2':
    "Meta's LLaMA 3.2 family, released alongside the Llama 3 lineup and tuned for efficient on-device use. QLoRa and SpinQuant variants compress the model for faster inference with minimal quality loss. Good general chat and coding performance at a small footprint.",
  'LFM 2.5':
    "Liquid AI's second generation of Liquid Foundation Models, designed for edge devices. Uses a non-transformer architecture that delivers fast inference and low memory use. Vision variants can analyze images in addition to regular chat.",
  'Bielik':
    'A Polish-language model from SpeakLeash, fine-tuned to natively understand and respond in Polish. Great for Polish-language chat, writing, and summarization tasks where other models feel clunky. Currently experimental in this app.',
};
