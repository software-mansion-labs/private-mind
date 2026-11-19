import { type SwmModelRole } from './family-descriptions';

export const SWM_AI_LABS_NAME = 'Software Mansion AI Labs';

export const SWM_ROLE_PREFIXES: Record<SwmModelRole, string> = {
  optimized: 'Optimized by',
  prepared: 'Prepared for mobile by',
};

export const SWM_ROLE_TITLES: Record<SwmModelRole, string> = {
  optimized: `${SWM_ROLE_PREFIXES.optimized} ${SWM_AI_LABS_NAME}`,
  prepared: `${SWM_ROLE_PREFIXES.prepared} ${SWM_AI_LABS_NAME}`,
};

export const SWM_ROLE_DETAILS: Record<SwmModelRole, string> = {
  optimized: "Compressed and exported for your phone's hardware",
  prepared: "Exported to run on your phone's hardware",
};

export const ATTRIBUTION_SHEET_TITLE = 'How this model runs on your phone';

export const ATTRIBUTION_CARD_HINT = 'Shows how this model runs on your phone';
export const OPENS_IN_BROWSER_HINT = 'Opens in your browser';

export const ATTRIBUTION_ROWS = {
  original: 'Original model',
  benchmarked: {
    title: 'Regularly benchmarked',
    detail: 'Speed and memory use on real devices',
  },
  private: {
    title: 'Private by design',
    detail: 'Runs on your device with React Native ExecuTorch',
  },
} as const;

export const VIEW_MODEL_DETAILS_LABEL = 'View model details';
export const ABOUT_SWM_LABEL = 'About Software Mansion AI Labs';

export const ABOUT_SWM_URL =
  'https://ai.swmansion.com/?utm_source=private-mind&utm_medium=app&utm_campaign=model-details';

export const APP_INFO_SWM_URL =
  'https://ai.swmansion.com/?utm_source=private-mind&utm_medium=app&utm_campaign=app-info';
