import { readFile } from '@dr.pogodin/react-native-fs';
import { Platform } from 'react-native';

const FEATURES_LINE = /^Features\s*:(.*)$/;

export const cpuinfoLacksLseAtomics = (cpuinfo: string): boolean => {
  const features = cpuinfo
    .split('\n')
    .map((line) => FEATURES_LINE.exec(line)?.[1])
    .filter((flags): flags is string => flags !== undefined);
  return (
    features.length > 0 &&
    features.some((flags) => !flags.trim().split(/\s+/).includes('atomics'))
  );
};

let lacksLseAtomics: Promise<boolean> | null = null;

export const cpuLacksLseAtomics = (): Promise<boolean> => {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  lacksLseAtomics ??= readFile('/proc/cpuinfo', 'utf8').then(
    cpuinfoLacksLseAtomics,
    () => false
  );
  return lacksLseAtomics;
};
