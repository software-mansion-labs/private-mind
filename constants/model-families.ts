import { SvgComponent } from '../utils/SvgComponent';
import GemmaIcon from '../assets/icons/families/gemma.svg';
import QwenIcon from '../assets/icons/families/qwen.svg';
import MetaIcon from '../assets/icons/families/meta.svg';
import LiquidIcon from '../assets/icons/families/liquid.svg';
import BielikIcon from '../assets/icons/families/bielik.svg';
import CubeIcon from '../assets/icons/cube.svg';

export interface ModelFamilyInfo {
  provider: string;
  icon: SvgComponent;
  summary: string;
  description: string;
}

export const MODEL_FAMILIES: Record<string, ModelFamilyInfo> = {
  'Qwen 3': {
    provider: 'Alibaba',
    icon: QwenIcon,
    summary: 'reasoning, optional thinking',
    description:
      "Alibaba's third generation of Qwen language models. The small variants here are optimized for mobile inference while keeping strong reasoning. They support an optional thinking mode for step-by-step problem solving.",
  },
  'Qwen 2.5': {
    provider: 'Alibaba',
    icon: QwenIcon,
    summary: 'chat, writing and code',
    description:
      'The previous Qwen generation, still a solid all-rounder for chat, summarization, and coding on-device. Available in several sizes so you can trade off quality against speed. Reliable pick when you want a well-rounded assistant.',
  },
  'LLaMA 3.2': {
    provider: 'Meta',
    icon: MetaIcon,
    summary: 'general chat and coding',
    description:
      "Meta's LLaMA 3.2 family, released alongside the Llama 3 lineup and tuned for efficient on-device use. QLoRa and SpinQuant variants compress the model for faster inference with minimal quality loss. Good general chat and coding performance at a small footprint.",
  },
  'LFM 2.5': {
    provider: 'Liquid AI',
    icon: LiquidIcon,
    summary: 'fast, some with vision',
    description:
      "Liquid AI's second generation of Liquid Foundation Models, designed for edge devices. Uses a non-transformer architecture that delivers fast inference and low memory use. Vision variants can analyze images in addition to regular chat.",
  },
  'Gemma 4': {
    provider: 'Google',
    icon: GemmaIcon,
    summary: 'small, chat and vision',
    description:
      "Google's Gemma 4 family, adapted here for efficient on-device inference. The 2B variants keep a compact footprint while offering capable general chat, and the multimodal variant can work with images in addition to text.",
  },
  'Bielik': {
    provider: 'SpeakLeash',
    icon: BielikIcon,
    summary: 'Polish chat and writing',
    description:
      'A Polish-language model from SpeakLeash, fine-tuned to natively understand and respond in Polish. Great for Polish-language chat, writing, and summarization tasks where other models feel clunky. Currently experimental in this app.',
  },
};

export const familyIcon = (familyName: string): SvgComponent =>
  MODEL_FAMILIES[familyName]?.icon ?? CubeIcon;
