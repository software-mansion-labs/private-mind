import { SvgComponent } from '../utils/SvgComponent';
import { LabelColor } from './model-labels';
import GemmaIcon from '@lobehub/icons-static-svg/icons/gemma-color.svg';
import QwenIcon from '@lobehub/icons-static-svg/icons/qwen-color.svg';
import MetaIcon from '@lobehub/icons-static-svg/icons/meta-color.svg';
import LiquidIcon from '@lobehub/icons-static-svg/icons/liquid.svg';

const FAMILY_ICONS: [prefix: string, icon: SvgComponent][] = [
  ['gemma', GemmaIcon],
  ['qwen', QwenIcon],
  ['llama', MetaIcon],
  ['lfm', LiquidIcon],
];

export const familyIcon = (familyName: string): SvgComponent | undefined => {
  const name = familyName.trim().toLowerCase();
  return FAMILY_ICONS.find(([prefix]) => name.startsWith(prefix))?.[1];
};

export const UNKNOWN_FAMILY_COLOR: LabelColor = 'periwinkle';

export const familyInitial = (familyName: string): string =>
  Array.from(familyName.trim())[0]?.toLocaleUpperCase() ?? '';
