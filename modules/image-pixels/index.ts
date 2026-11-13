import { requireNativeModule } from 'expo';

export interface DecodedImage {
  width: number;
  height: number;
  data: Uint8Array;
}

interface NativeImagePixels {
  decodeRgba: (uri: string, maxSide: number) => Promise<DecodedImage>;
}

let nativeModule: NativeImagePixels | null = null;

export const decodeImageRgba = (
  uri: string,
  maxSide: number
): Promise<DecodedImage> => {
  nativeModule ??= requireNativeModule<NativeImagePixels>('ImagePixels');
  return nativeModule.decodeRgba(uri, maxSide);
};
