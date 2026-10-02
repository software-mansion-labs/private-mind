import type { Theme } from '../../styles/colors';
import type { Verdict } from '../../utils/devBenchmark/types';

export const verdictColor = (theme: Theme, verdict: Verdict): string => {
  switch (verdict) {
    case 'pass':
      return theme.text.success;
    case 'warn':
      return theme.text.warning;
    case 'fail':
      return theme.text.error;
  }
};

export const VERDICT_LABELS: Record<Verdict, string> = {
  pass: 'Green',
  warn: 'Yellow',
  fail: 'Red',
};
