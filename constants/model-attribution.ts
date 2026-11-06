import { type SwmModelRole } from './family-descriptions';

export const SWM_ROLE_TITLES: Record<SwmModelRole, string> = {
  optimized: 'Optimized by Software Mansion',
  prepared: 'Prepared for mobile by Software Mansion',
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
export const ABOUT_SWM_LABEL = 'About Software Mansion';

export const ABOUT_SWM_URL =
  'https://swmansion.com/?utm_source=private-mind&utm_medium=app&utm_campaign=model-details';
