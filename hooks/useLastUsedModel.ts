import { useEffect, useState } from 'react';
import type { Model } from '../database/modelRepository';
import { useModelStore } from '../store/modelStore';
import { getLastUsedModelId } from '../utils/lastUsedModel';

export const useLastUsedModel = (): Model | null => {
  const [modelId, setModelId] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    getLastUsedModelId()
      .then((id) => {
        if (mounted) setModelId(id);
      })
      .catch((error) =>
        console.warn('Could not read the last used model', error)
      );
    return () => {
      mounted = false;
    };
  }, []);

  const model = useModelStore((state) =>
    modelId === null ? undefined : state.getModelById(modelId)
  );
  return model ?? null;
};
