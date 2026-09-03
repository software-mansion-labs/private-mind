import {
  WEB_RETRIEVAL_CHUNK_CHARS,
  WEB_RETRIEVAL_MIN_TOP_K,
  WEB_RETRIEVAL_TOP_K,
} from '../../constants/web';

export const topKForBudget = (
  contextCharBudget: number | undefined,
  profileTopK: number = WEB_RETRIEVAL_TOP_K
): number => {
  if (contextCharBudget === undefined || !Number.isFinite(contextCharBudget)) {
    return profileTopK;
  }
  const fits = Math.floor(contextCharBudget / WEB_RETRIEVAL_CHUNK_CHARS);
  return Math.max(WEB_RETRIEVAL_MIN_TOP_K, Math.min(profileTopK, fits));
};
