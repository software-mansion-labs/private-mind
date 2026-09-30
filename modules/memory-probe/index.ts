import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface NativeMemoryProbe {
  getPhysFootprintBytes: () => number;
}

const nativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<NativeMemoryProbe>('MemoryProbe')
    : null;

export const PHYS_FOOTPRINT_METRIC = 'phys_footprint';

export const isPhysFootprintAvailable = () => nativeModule !== null;

export const getPhysFootprintBytes = (): number | null => {
  if (!nativeModule) return null;
  const bytes = nativeModule.getPhysFootprintBytes();
  return bytes < 0 ? null : bytes;
};
