import { type Model } from '../database/modelRepository';

type Listener = (model: Model) => void;

const listeners = new Set<Listener>();

export const onModelFilesReplaced = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const announceModelFilesReplaced = (model: Model) => {
  listeners.forEach((listener) => listener(model));
};
