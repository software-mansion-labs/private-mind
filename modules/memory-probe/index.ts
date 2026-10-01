import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import DeviceInfo from 'react-native-device-info';

interface NativeMemoryProbe {
  getPhysFootprintBytes: () => number;
}

const nativeModule =
  Platform.OS === 'ios'
    ? requireOptionalNativeModule<NativeMemoryProbe>('MemoryProbe')
    : null;

export const PHYS_FOOTPRINT_METRIC = 'phys_footprint';
export const TOTAL_PSS_METRIC = 'total_pss';

export const PHYS_FOOTPRINT_SAMPLE_MS = 250;
export const TOTAL_PSS_SAMPLE_MS = 1000;

export const metricFor = (
  hasNativeProbe: boolean,
  os: string
): string | null => {
  if (hasNativeProbe) return PHYS_FOOTPRINT_METRIC;
  return os === 'android' ? TOTAL_PSS_METRIC : null;
};

export const sampleIntervalForMetric = (metric: string | null) =>
  metric === PHYS_FOOTPRINT_METRIC
    ? PHYS_FOOTPRINT_SAMPLE_MS
    : TOTAL_PSS_SAMPLE_MS;

export const isPhysFootprintAvailable = () => nativeModule !== null;

export const memoryMetric = (): string | null =>
  metricFor(nativeModule !== null, Platform.OS);

export const isMemoryMetricAvailable = () => memoryMetric() !== null;

export const memorySampleIntervalMs = () =>
  sampleIntervalForMetric(memoryMetric());

export const getPhysFootprintBytes = (): number | null => {
  if (!nativeModule) return null;
  const bytes = nativeModule.getPhysFootprintBytes();
  return bytes < 0 ? null : bytes;
};

export const getMemoryFootprintBytes = (): number | null => {
  if (nativeModule) return getPhysFootprintBytes();
  if (memoryMetric() !== TOTAL_PSS_METRIC) return null;
  try {
    const bytes = DeviceInfo.getUsedMemorySync();
    return bytes < 0 ? null : bytes;
  } catch (error) {
    console.warn('Unable to read memory:', error);
    return null;
  }
};
