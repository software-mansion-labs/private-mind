import { topKForBudget } from '../utils/web/retrievalBudget';
import {
  WEB_RETRIEVAL_CHUNK_CHARS,
  WEB_RETRIEVAL_MIN_TOP_K,
  WEB_RETRIEVAL_TOP_K,
} from '../constants/web';

describe('topKForBudget', () => {
  it('keeps the profile default when there is room for every chunk', () => {
    expect(topKForBudget(WEB_RETRIEVAL_CHUNK_CHARS * 20)).toBe(
      WEB_RETRIEVAL_TOP_K
    );
  });

  it('retrieves only what the remaining budget can actually hold', () => {
    expect(topKForBudget(WEB_RETRIEVAL_CHUNK_CHARS * 3)).toBe(3);
    expect(topKForBudget(WEB_RETRIEVAL_CHUNK_CHARS * 4 + 100)).toBe(4);
  });

  it('never drops below the minimum, so a tight budget still gets evidence', () => {
    expect(topKForBudget(0)).toBe(WEB_RETRIEVAL_MIN_TOP_K);
    expect(topKForBudget(10)).toBe(WEB_RETRIEVAL_MIN_TOP_K);
  });

  it('never exceeds what the model profile allows', () => {
    expect(topKForBudget(WEB_RETRIEVAL_CHUNK_CHARS * 50, 3)).toBe(3);
  });

  it('falls back to the profile value when the budget is unknown', () => {
    expect(topKForBudget(undefined)).toBe(WEB_RETRIEVAL_TOP_K);
    expect(topKForBudget(Number.NaN, 4)).toBe(4);
  });
});
