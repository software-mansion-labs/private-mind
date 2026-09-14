import { ImageSourcePropType } from 'react-native';

export interface OnboardingIllustration {
  source: ImageSourcePropType;
  aspectRatio: number;
  anchor: 'top' | 'bottom';
}

export interface OnboardingSlide {
  id: string;
  label: string;
  title: string;
  description: string;
  buttonLabel: string;
  illustration: OnboardingIllustration;
}

export const INTRO_ILLUSTRATION = require('../assets/onboarding/step_chat.png');

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'offline',
    label: 'Offline AI access',
    title: 'Chat with AI models offline',
    description:
      'Interact with AI models securely and offline on your mobile device.',
    buttonLabel: 'Got it, next',
    illustration: {
      source: INTRO_ILLUSTRATION,
      aspectRatio: 300 / 613,
      anchor: 'top',
    },
  },
  {
    id: 'web-search',
    label: 'Web search',
    title: 'Ask about things that happened today',
    description:
      'The model reads live pages and cites its sources. Only the search query leaves your device.',
    buttonLabel: 'Nice, next',
    illustration: {
      source: require('../assets/onboarding/step_websearch.png'),
      aspectRatio: 300 / 618,
      anchor: 'top',
    },
  },
  {
    id: 'documents',
    label: 'Your documents',
    title: 'Add source documents',
    description: 'Use extra files to extend models knowledge and responses.',
    buttonLabel: 'Great, next',
    illustration: {
      source: require('../assets/onboarding/step_sources.png'),
      aspectRatio: 300 / 618,
      anchor: 'bottom',
    },
  },
  {
    id: 'voice',
    label: 'Speech to text',
    title: 'Use voice instead of chat',
    description: 'Use voice messages that automatically transcript into text.',
    buttonLabel: 'Start chatting',
    illustration: {
      source: require('../assets/onboarding/step_voice.png'),
      aspectRatio: 300 / 613,
      anchor: 'bottom',
    },
  },
];

export const SPILL_DURATION = 500;
export const INTRO_STAGGER_MS = 80;

export const GLOW_PARALLAX = 0.6;
export const ILLUSTRATION_PARALLAX = 0.35;
export const TITLE_LEAD = -0.12;
export const DESCRIPTION_LEAD = -0.18;

export const DOT_SIZE = 6;
export const DOT_ACTIVE_WIDTH = 20;
export const DOT_GAP = 6;

export const ILLUSTRATION_MAX_WIDTH = 340;
export const ILLUSTRATION_SIDE_INSET = 24;
export const ILLUSTRATION_TOP_CLEARANCE = 48;
export const GLOW_SIZE = 420;

export const CARD_INSET = 16;
export const CARD_PADDING = 16;
export const CARD_GAP = 24;
export const CONTROLS_GAP = 16;
export const PAGINATION_HEIGHT = 24;
export const BUTTON_HEIGHT = 48;
export const ILLUSTRATION_CLEARANCE = 8;
export const CONTROLS_HEIGHT = PAGINATION_HEIGHT + CONTROLS_GAP + BUTTON_HEIGHT;
