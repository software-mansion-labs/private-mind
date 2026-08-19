import { useCallback, useEffect, useRef, useState } from 'react';
import { Model } from '../../database/modelRepository';
import { useStableCallback } from '../../hooks/useStableCallback';

const DISMISSAL_TIMEOUT_MS = 5000;

type ModelSwitchState =
  | { status: 'idle' }
  | { status: 'awaitingDismissal'; model: Model }
  | { status: 'loading'; model: Model };

const IDLE: ModelSwitchState = { status: 'idle' };

export const useModelSwitch = (loadModel: (model: Model) => Promise<void>) => {
  const [state, setState] = useState<ModelSwitchState>(IDLE);
  const stateRef = useRef<ModelSwitchState>(IDLE);
  const framesRef = useRef<number[]>([]);
  const stableLoadModel = useStableCallback(loadModel);

  const commit = useCallback((next: ModelSwitchState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const cancelFrames = useCallback(() => {
    framesRef.current.forEach(cancelAnimationFrame);
    framesRef.current = [];
  }, []);

  useEffect(() => cancelFrames, [cancelFrames]);

  useEffect(() => {
    if (state.status !== 'awaitingDismissal') return;
    const timer = setTimeout(() => commit(IDLE), DISMISSAL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [state, commit]);

  useEffect(() => {
    if (state.status !== 'loading') return;
    let cancelled = false;
    stableLoadModel(state.model)
      .catch((error) => console.error('Error switching model:', error))
      .finally(() => {
        if (!cancelled) commit(IDLE);
      });
    return () => {
      cancelled = true;
    };
  }, [state, stableLoadModel, commit]);

  const pickModel = useCallback(
    (model: Model) => {
      if (stateRef.current.status !== 'idle') return;
      commit({ status: 'awaitingDismissal', model });
    },
    [commit]
  );

  const handleSheetStateChange = useCallback(
    (isOpen: boolean) => {
      const current = stateRef.current;
      if (current.status !== 'awaitingDismissal') return;

      if (isOpen) {
        cancelFrames();
        commit(IDLE);
        return;
      }

      cancelFrames();
      framesRef.current.push(
        requestAnimationFrame(() => {
          framesRef.current.push(
            requestAnimationFrame(() =>
              commit({ status: 'loading', model: current.model })
            )
          );
        })
      );
    },
    [cancelFrames, commit]
  );

  return {
    pendingModel: state.status === 'idle' ? undefined : state.model,
    isSwitching: state.status !== 'idle',
    pickModel,
    handleSheetStateChange,
  };
};
