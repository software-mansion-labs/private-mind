import { useEffect } from 'react';
import { useIsFocused } from 'expo-router';
import { useReadAloudStore } from '../store/readAloudStore';

export const useStopReadAloudOnLeave = (chatId: number) => {
  const isFocused = useIsFocused();

  useEffect(() => {
    if (!isFocused) return;
    return () => {
      useReadAloudStore.getState().stop();
    };
  }, [chatId, isFocused]);
};
