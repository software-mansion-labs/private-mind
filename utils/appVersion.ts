import * as Application from 'expo-application';
import { LATEST_RELEASE } from '../constants/latest-release';

const versionParts = (version: string): number[] =>
  version.split('.').map((part) => Number.parseInt(part, 10) || 0);

export const isVersionAtLeast = (version: string, minimum: string): boolean => {
  const have = versionParts(version);
  const need = versionParts(minimum);
  const length = Math.max(have.length, need.length);
  for (let index = 0; index < length; index += 1) {
    const a = have[index] ?? 0;
    const b = need[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
};

export const currentAppVersion = (): string =>
  Application.nativeApplicationVersion ?? LATEST_RELEASE.version;
