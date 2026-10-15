import { truncateAtRepeatedClause } from './loopDetection';
import { normalizeModelText } from './normalizeModelText';
import { stripSpecialTokens } from './specialTokens';
import { mapOutsideThink } from './thinking';

export const tidyVisibleAnswer = (response: string): string =>
  mapOutsideThink(stripSpecialTokens(response), (segment) =>
    truncateAtRepeatedClause(normalizeModelText(segment))
  );
