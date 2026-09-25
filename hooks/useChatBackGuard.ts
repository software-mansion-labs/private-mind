import { useCallback } from 'react';
import { BackHandler } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTurnInFlight } from './useTurnInFlight';
import { showTurnInFlightNotice } from '../utils/turnInFlightNotice';

export const useChatBackGuard = (exitsAppOnBack: boolean): void => {
  const turnInFlight = useTurnInFlight();

  useFocusEffect(
    useCallback(() => {
      if (!turnInFlight && !exitsAppOnBack) return;

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (turnInFlight) {
            showTurnInFlightNotice();
            return true;
          }
          BackHandler.exitApp();
          return true;
        }
      );

      return () => subscription.remove();
    }, [exitsAppOnBack, turnInFlight])
  );
};
