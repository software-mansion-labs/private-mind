import { ThemeColors } from '../styles/colors';
import { SvgComponent } from '../utils/SvgComponent';
import LightBulbIcon from '../assets/icons/light_bulb.svg';
import EyeIcon from '../assets/icons/eye.svg';
import FlashIcon from '../assets/icons/flash.svg';

export type LabelColor = keyof ThemeColors['label'];

export const THINKING_LABEL = 'Thinking';
export const VISION_LABEL = 'Vision';

const UNKNOWN_LABEL_COLOR: LabelColor = 'periwinkle';

const LABEL_COLORS = new Map<string, LabelColor>([
  ['thinking', 'gold'],
  ['vision', 'sky'],
  ['fast', 'orange'],
  ['powerful', 'red'],
  ['small', 'lime'],
  ['great first model', 'green'],
  ['balanced', 'mint'],
  ['capable', 'cyan'],
  ['smart', 'blue'],
  ['reasoning', 'violet'],
  ['good at coding', 'lilac'],
  ['polish', 'pink'],
]);

const LABEL_ICONS = new Map<string, SvgComponent>([
  ['thinking', LightBulbIcon],
  ['vision', EyeIcon],
  ['fast', FlashIcon],
]);

const normalizeLabel = (label: string) =>
  label.trim().replace(/\s+/g, ' ').toLowerCase();

export const labelColor = (label: string): LabelColor =>
  LABEL_COLORS.get(normalizeLabel(label)) ?? UNKNOWN_LABEL_COLOR;

export const labelIcon = (label: string): SvgComponent | undefined =>
  LABEL_ICONS.get(normalizeLabel(label));

const CAPABILITY_LABELS = new Set(
  [THINKING_LABEL, VISION_LABEL].map(normalizeLabel)
);

export const isCapabilityLabel = (label: string) =>
  CAPABILITY_LABELS.has(normalizeLabel(label));
