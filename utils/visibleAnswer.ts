import { hasRunawayLoop, truncateAtRepeatedClause } from './loopDetection';
import { normalizeModelText } from './normalizeModelText';
import { stripSpecialTokens } from './specialTokens';
import { mapOutsideThink, outsideThinkSegments } from './thinking';

export const tidyVisibleAnswer = (response: string): string =>
  mapOutsideThink(stripSpecialTokens(response), (segment) =>
    truncateAtRepeatedClause(normalizeModelText(segment))
  );

export const answerRunsAwayInLoop = (streamed: string): boolean =>
  outsideThinkSegments(stripSpecialTokens(streamed)).some((segment) =>
    hasRunawayLoop(normalizeModelText(segment))
  );
