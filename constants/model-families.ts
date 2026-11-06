import { SvgComponent } from '../utils/SvgComponent';
import { LabelColor } from './model-labels';
import GemmaIcon from '@lobehub/icons-static-svg/icons/gemma-color.svg';
import QwenIcon from '@lobehub/icons-static-svg/icons/qwen-color.svg';
import MetaIcon from '@lobehub/icons-static-svg/icons/meta-color.svg';
import LiquidIcon from '@lobehub/icons-static-svg/icons/liquid.svg';
import BielikIcon from '../assets/icons/bielik.svg';

const FAMILY_ICONS: [
  prefix: string,
  icon: SvgComponent,
  opticalScale: number,
][] = [
  ['gemma', GemmaIcon, 1],
  ['qwen', QwenIcon, 0.9],
  ['llama', MetaIcon, 1],
  ['lfm', LiquidIcon, 0.8],
  ['bielik', BielikIcon, 1],
];

const findFamilyIcon = (familyName: string) => {
  const name = familyName.trim().toLowerCase();
  return FAMILY_ICONS.find(([prefix]) => name.startsWith(prefix));
};

export const familyIcon = (familyName: string): SvgComponent | undefined =>
  findFamilyIcon(familyName)?.[1];

export const familyIconScale = (familyName: string): number =>
  findFamilyIcon(familyName)?.[2] ?? 1;

export const UNKNOWN_FAMILY_COLOR: LabelColor = 'periwinkle';

export const familyInitial = (familyName: string): string =>
  Array.from(familyName.trim())[0]?.toLocaleUpperCase() ?? '';
