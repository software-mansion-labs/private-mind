import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { useStableCallback } from './useStableCallback';

export const useBackToDismiss = (active: boolean, onBack: () => void) => {
  const handleBack = useStableCallback(onBack);

  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleBack();
        return true;
      }
    );
    return () => subscription.remove();
  }, [active, handleBack]);
};
