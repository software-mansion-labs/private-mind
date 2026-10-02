import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useLLMStore } from '../store/llmStore';

export const useTurnResumesOnForeground = () => {
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      const llm = useLLMStore.getState();
      if (next === 'active') llm.appReturnedToForeground();
      else if (next === 'background') llm.appWentToBackground();
      else llm.appLeftForeground();
    });
    return () => subscription.remove();
  }, []);
};
