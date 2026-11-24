import { getDeviceMemoryGB } from './modelCompatibility';

export const deviceMemoryGBOrZero = (): number => {
  try {
    return getDeviceMemoryGB();
  } catch {
    return 0;
  }
};
