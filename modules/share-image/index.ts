import { requireOptionalNativeModule } from 'expo';

interface NativeShareImage {
  share: (fileUri: string, text: string, dialogTitle: string) => Promise<void>;
}

export const nativeShareImage =
  requireOptionalNativeModule<NativeShareImage>('ShareImage');
