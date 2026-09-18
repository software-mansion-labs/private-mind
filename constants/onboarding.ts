import { ImageSourcePropType } from 'react-native';
import { SvgComponent } from '../utils/SvgComponent';
import WelcomeArt from '../assets/onboarding/welcome.svg';
import LockIcon from '../assets/icons/lock.svg';
import WebIcon from '../assets/icons/web.svg';
import SourceIcon from '../assets/icons/source.svg';
import SoundwaveIcon from '../assets/icons/soundwave.svg';

export interface OnboardingIllustration {
  source: ImageSourcePropType;
  aspectRatio: number;
  anchor: 'top' | 'bottom';
}

export interface OnboardingIcon {
  art: SvgComponent;
  aspectRatio: number;
  scale?: number;
}

export interface OnboardingSlide {
  id: string;
  label: string;
  title: string;
  buttonLabel: string;
  icon: OnboardingIcon;
  illustration: OnboardingIllustration;
}

export const INTRO_ART = WelcomeArt;
export const INTRO_ART_ASPECT_RATIO = 300 / 420;
export const STEP_ART_ASPECT_RATIO = 900 / 1856;

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'offline',
    label: 'Offline AI access',
    title: 'Models that run on your phone',
    buttonLabel: 'Got it, next',
    icon: { art: LockIcon, aspectRatio: 16 / 20, scale: 0.85 },
    illustration: {
      source: require('../assets/onboarding/step_chat.png'),
      aspectRatio: STEP_ART_ASPECT_RATIO,
      anchor: 'top',
    },
  },
  {
    id: 'web-search',
    label: 'Web search',
    title: 'Only the search query leaves your device',
    buttonLabel: 'Nice, next',
    icon: { art: WebIcon, aspectRatio: 1 },
    illustration: {
      source: require('../assets/onboarding/step_websearch.png'),
      aspectRatio: STEP_ART_ASPECT_RATIO,
      anchor: 'top',
    },
  },
  {
    id: 'documents',
    label: 'Your documents',
    title: 'Answers drawn from your own files',
    buttonLabel: 'Great, next',
    icon: { art: SourceIcon, aspectRatio: 16 / 20, scale: 0.85 },
    illustration: {
      source: require('../assets/onboarding/step_sources.png'),
      aspectRatio: STEP_ART_ASPECT_RATIO,
      anchor: 'bottom',
    },
  },
  {
    id: 'voice',
    label: 'Speech to text',
    title: 'Speak instead of typing',
    buttonLabel: 'Start chatting',
    icon: { art: SoundwaveIcon, aspectRatio: 1 },
    illustration: {
      source: require('../assets/onboarding/step_voice.png'),
      aspectRatio: STEP_ART_ASPECT_RATIO,
      anchor: 'bottom',
    },
  },
];

export const INTRO_FADE_MS = 400;
export const INTRO_LIFT = 24;
export const INTRO_STAGGER_MS = 80;

export const ILLUSTRATION_PARALLAX = 0.35;
export const BADGE_LEAD = -0.12;
export const TITLE_LEAD = -0.18;

export const DOT_SIZE = 6;
export const DOT_ACTIVE_WIDTH = 20;
export const DOT_GAP = 6;

export const ILLUSTRATION_MAX_WIDTH = 300;
export const INTRO_ART_MAX_WIDTH = 340;
export const ILLUSTRATION_SIDE_INSET = 24;
export const ILLUSTRATION_TOP_CLEARANCE = 48;
export const CROP_FADE = 160;

export const CARD_INSET = 16;
export const CONTENT_PADDING = 16;
export const TEXT_CONTROLS_GAP = 24;
export const CONTROLS_GAP = 16;
export const PAGINATION_HEIGHT = 24;
export const BUTTON_HEIGHT = 48;
export const ILLUSTRATION_CLEARANCE = 8;
export const CONTROLS_HEIGHT = PAGINATION_HEIGHT + CONTROLS_GAP + BUTTON_HEIGHT;
export const SCRIM_RISE = 200;
export const LABEL_ICON_SIZE = 16;
