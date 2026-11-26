import { requireOptionalNativeModule } from 'expo';

interface NativeShareImage {
  isInstalled: (packageName: string) => boolean;
  share: (fileUri: string, text: string, dialogTitle: string) => Promise<void>;
  shareToPackage: (
    fileUri: string,
    text: string,
    packageName: string
  ) => Promise<void>;
}

export const nativeShareImage =
  requireOptionalNativeModule<NativeShareImage>('ShareImage');
