import { requireOptionalNativeModule } from 'expo';

interface NativeDisplayCorners {
  getCornerRadius: () => Promise<number>;
}

const nativeModule =
  requireOptionalNativeModule<NativeDisplayCorners>('DisplayCorners');

export const STRAIGHT_CORNER_RADIUS = 0;

export const getDisplayCornerRadius = async (): Promise<number> => {
  if (!nativeModule) return STRAIGHT_CORNER_RADIUS;
  try {
    return await nativeModule.getCornerRadius();
  } catch (error) {
    console.warn('Unable to read display corner radius:', error);
    return STRAIGHT_CORNER_RADIUS;
  }
};
