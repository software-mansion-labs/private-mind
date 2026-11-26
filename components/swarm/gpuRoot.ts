import tgpu, { type TgpuRoot } from 'typegpu';

let sharedRoot: Promise<TgpuRoot> | null = null;

export const getGpuRoot = () => {
  sharedRoot ??= tgpu.init().catch((error) => {
    sharedRoot = null;
    throw error;
  });
  return sharedRoot;
};
