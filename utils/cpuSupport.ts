import { readFile } from '@dr.pogodin/react-native-fs';
import { Platform } from 'react-native';

// TEMPORARY FIX (#437 A2): react-native-executorch 0.10.4 ships a libexecutorch.so
// with LSE atomics that crash ARMv8.0 CPUs (SIGILL). Remove this whole check once
// RNE ships a build that runs on those CPUs: this file, store/cpuSupportStore.ts,
// hooks/useUnsupportedCpuNotice.ts, constants/cpu-support.ts, the gate in
// llmStore.loadModel and the 'cpu-unsupported' send refusal.

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
