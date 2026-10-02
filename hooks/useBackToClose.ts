import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useStableCallback } from './useStableCallback';

export const useBackToClose = (isOpen: boolean, close: () => void) => {
  const stableClose = useStableCallback(close);

  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        stableClose();
        return true;
      }
    );
    return () => subscription.remove();
  }, [isOpen, stableClose]);
};
