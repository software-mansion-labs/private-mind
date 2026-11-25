import {
  WEB_FIRST_TURN_SOURCE_CAP_MAX_HISTORY_TOKENS,
  WEB_FIRST_TURN_SOURCE_CAP_TOKENS,
  estimatePromptTokens,
} from '../../constants/context-window';
import type { WebContext, WebSourceDocument } from './types';

export interface CappedWebContext extends WebContext {
  dropped: number;
}

export const isShortHistory = (
  history: { role: string; content: string }[]
): boolean =>
  estimatePromptTokens(
    history
      .filter((turn) => turn.role === 'user' || turn.role === 'assistant')
      .map((turn) => turn.content)
      .join(' ')
  ) <= WEB_FIRST_TURN_SOURCE_CAP_MAX_HISTORY_TOKENS;

const asUnread = (source: WebSourceDocument): WebSourceDocument => ({
  kind: 'web',
  name: source.name,
  url: source.url,
  read: false,
  ...(source.query ? { query: source.query } : {}),
  ...(source.sourceQuery ? { sourceQuery: source.sourceQuery } : {}),
});

export const capWebSources = (
  web: WebContext,
  capTokens: number = WEB_FIRST_TURN_SOURCE_CAP_TOKENS
): CappedWebContext => {
  let usedTokens = 0;
  let kept = 0;
  for (const block of web.context) {
    const cost = estimatePromptTokens(block);
    if (kept > 0 && usedTokens + cost > capTokens) break;
    usedTokens += cost;
    kept += 1;
  }
  const dropped = web.context.length - kept;
  if (dropped === 0) return { ...web, dropped };
  return {
    context: web.context.slice(0, kept),
    sourceDocuments: web.sourceDocuments.map((source, index) =>
      index >= kept && index < web.context.length ? asUnread(source) : source
    ),
    dropped,
  };
};
