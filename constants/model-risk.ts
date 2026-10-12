import type { ModelRisk } from '../utils/modelCompatibility';

export type ModelRiskCopy = {
  readonly chip: string;
  readonly title: string;
  readonly body: string;
};

export const BENCHMARK_FIRST_LABEL = 'Run benchmark first';

export const RISK_NOTICE_DISMISS_LABEL = 'Got it';

export const getModelRiskCopy = (
  risk: ModelRisk,
  modelName: string
): ModelRiskCopy | null => {
  switch (risk.reason) {
    case 'fits':
      return null;
    case 'unknown-size':
      return {
        chip: 'Size unknown',
        title: 'Size unknown',
        body: `The app cannot tell how much memory ${modelName} needs on this device. The benchmark is the only way to find out before you rely on it.`,
      };
    case 'little-headroom':
      return {
        chip: 'Tight fit',
        title: 'Tight fit for this device',
        body: `${modelName} fits in memory with little to spare. Expect a slow first reply, and the app may reload in the middle of a long chat or a web search.`,
      };
    case 'over-budget':
    case 'below-declared-floor':
      return {
        chip: 'May crash',
        title: 'May crash the app',
        body: `${modelName} needs more memory than this device can give it. The system can kill the app while it loads or answers, even while you are in another app, and anything unsaved in the current chat goes with it. The benchmark may crash too; that is a result, not a fault.`,
      };
  }
};
