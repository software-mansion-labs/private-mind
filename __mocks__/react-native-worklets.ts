export const scheduleOnRN = (fn: (...args: any[]) => unknown, ...args: any[]) =>
  fn(...args);
export const scheduleOnUI = (fn: (...args: any[]) => unknown, ...args: any[]) =>
  fn(...args);
export const runOnUI = (fn: (...args: any[]) => unknown) => fn;
export const runOnJS = (fn: (...args: any[]) => unknown) => fn;
export const createWorkletRuntime = () => ({});
export const isWorkletFunction = () => false;
