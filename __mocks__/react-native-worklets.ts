/**
 * The real module throws on import outside a runtime with the native part
 * installed. Tests only ever need the JS-thread hop, which is a direct call.
 */
export const scheduleOnRN = (fn: (...args: any[]) => unknown, ...args: any[]) =>
  fn(...args);
export const scheduleOnUI = (fn: (...args: any[]) => unknown, ...args: any[]) =>
  fn(...args);
export const runOnUI = (fn: (...args: any[]) => unknown) => fn;
export const runOnJS = (fn: (...args: any[]) => unknown) => fn;
export const createWorkletRuntime = () => ({});
export const isWorkletFunction = () => false;
