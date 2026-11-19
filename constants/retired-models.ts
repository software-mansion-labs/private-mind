export const RETIRED_MODEL_REPLACEMENTS: Record<string, string> = {
  'LLaMA 3.2 - 1B - QLoRa': 'LLaMA 3.2 - 1B - SpinQuant',
  'LLaMA 3.2 - 3B - QLoRa': 'LLaMA 3.2 - 3B - SpinQuant',
};

export const RETIRED_MODEL_NAMES = Object.keys(RETIRED_MODEL_REPLACEMENTS);
