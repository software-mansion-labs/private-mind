export const MODEL_MIN_RAM_GB: Record<string, number> = {
  'Gemma 4 VL - 2B': 7,
  'LFM 3 VL - 2B': 7,
};

const IPHONE_SE_DEVICE_IDS = ['iPhone12,8', 'iPhone14,6'];

export const MODEL_BLOCKED_DEVICE_IDS: Record<string, string[]> = {
  'Qwen 3 - 0.6B': IPHONE_SE_DEVICE_IDS,
  'Qwen 3 - 1.7B': IPHONE_SE_DEVICE_IDS,
};
