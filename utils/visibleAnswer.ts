import { hasRunawayLoop, truncateAtRepeatedClause } from './loopDetection';
import { normalizeModelText } from './normalizeModelText';
import { stripSpecialTokens } from './specialTokens';
import { mapOutsideThink, outsideThinkSegments } from './thinking';

const TURN_BOUNDARY_MARKER =
  /<\|im_start\|>|<\|im_end\|>|<\|start_header_id\|>|<\|eot_id\|>|<\|endoftext\|>|<start_of_turn>|<end_of_turn>/;

const turnBoundaryAfterText = (response: string): number | null => {
  const at = response.search(TURN_BOUNDARY_MARKER);
  if (at <= 0 || !stripSpecialTokens(response.slice(0, at)).trim()) {
    return null;
  }
  return at;
};

const beforeNextTurn = (response: string): string => {
  const at = turnBoundaryAfterText(response);
  return at === null ? response : response.slice(0, at).trimEnd();
};

export const tidyVisibleAnswer = (response: string): string =>
  mapOutsideThink(stripSpecialTokens(beforeNextTurn(response)), (segment) =>
    truncateAtRepeatedClause(normalizeModelText(segment))
  );

export const answerRunsAwayInLoop = (streamed: string): boolean =>
  outsideThinkSegments(stripSpecialTokens(streamed)).some((segment) =>
    hasRunawayLoop(normalizeModelText(segment))
  );

export const answerOpensNextTurn = (streamed: string): boolean =>
  turnBoundaryAfterText(streamed) !== null;
