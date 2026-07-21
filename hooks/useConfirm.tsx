import React, { useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import type { AppBottomSheetRef } from '../components/bottomSheets/AppBottomSheet';
import WarningSheet, {
  WarningSheetData,
} from '../components/bottomSheets/WarningSheet';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
}

export const useConfirm = () => {
  const sheetRef = useRef<AppBottomSheetRef<WarningSheetData>>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(confirmed);
  }, []);

  const confirm = useCallback(
    ({ title, message, confirmLabel }: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        if (Platform.OS === 'ios') {
          Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: confirmLabel,
              style: 'destructive',
              onPress: () => resolve(true),
            },
          ]);
          return;
        }

        settle(false);

        if (!sheetRef.current) {
          resolve(false);
          return;
        }

        resolveRef.current = resolve;
        sheetRef.current.present({
          title,
          subtitle: message,
          buttonTitle: confirmLabel,
          onConfirm: () => settle(true),
        });
      }),
    [settle]
  );

  const ConfirmElement =
    Platform.OS === 'android' ? (
      <WarningSheet
        bottomSheetModalRef={sheetRef}
        onDismiss={() => settle(false)}
      />
    ) : null;

  return { confirm, ConfirmElement };
};
